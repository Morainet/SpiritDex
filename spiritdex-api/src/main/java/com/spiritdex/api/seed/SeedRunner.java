package com.spiritdex.api.seed;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spiritdex.api.entity.*;
import com.spiritdex.api.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.math.BigDecimal;
import java.util.*;

/**
 * Phase 1 数据导入：读取 data/seed/*.json，批量入库。
 *
 * <p>仅在 {@code seed} profile 下激活：
 * <pre>{@code
 * mvn spring-boot:run -Dspring-boot.run.profiles=seed
 * }</pre>
 *
 * <h3>批量优化（跨国 Supabase 必备）</h3>
 * <p>原逐条 select+insert 模式在跨国高延迟（~200ms/往返）下极慢（671 精灵 × N 表 ≈ 上万往返）。
 * 现改为：<b>TRUNCATE 清表 → 内存攒批 → {@link Db#saveBatch} 批量提交</b>。配合 JDBC
 * {@code reWriteBatchedInserts=true}，PG 驱动把 100 条 insert 合成 1 条 VALUES(...),(...)，
 * 往返次数从上万降到几十。导入后用一次 selectList 回查主键 id 供关联表用。
 *
 * <p>幂等性：除 article 外每表先 TRUNCATE（物理清空 + 重置序列 + 级联关联表）再批量插入，
 * 重复运行结果一致（safe re-run）。article 保留 AI 生成内容，按 slug upsert。
 */
@Slf4j
@Component
@Profile("seed")
@RequiredArgsConstructor
public class SeedRunner implements CommandLineRunner {

    private final ObjectMapper objectMapper;
    private final SeedProperties props;
    /** 原生 JDBC：用 TRUNCATE 物理清表（绕过 @TableLogic 逻辑删除），保证 seed 幂等。 */
    private final JdbcTemplate jdbcTemplate;

    private final TypeMapper typeMapper;
    private final SkillMapper skillMapper;
    private final PetMapper petMapper;
    private final EvolutionChainMapper evolutionChainMapper;
    private final ArticleMapper articleMapper;

    /** 批量插入分片大小（每批 100 条一次提交）。 */
    private static final int BATCH = 100;

    @Override
    public void run(String... args) {
        File dir = new File(props.getDir());
        if (!dir.isDirectory()) {
            throw new IllegalStateException("seed 目录不存在: " + dir.getAbsolutePath()
                    + "（请先运行 scraper/main.py 生成 data/seed/*.json）");
        }
        log.info("[seed] 开始导入，目录: {}", dir.getAbsolutePath());

        int t = seedTypes(dir);
        Map<String, Long> typeSlugToId = loadSlugToId(Type.class);

        int s = seedSkills(dir);
        Map<String, Long> skillCatalogToId = loadCatalogToId(Skill.class);

        int p = seedPets(dir, typeSlugToId);
        Map<String, Long> petSlugToId = loadSlugToId(Pet.class);
        Map<String, Long> petCatalogToId = loadCatalogToId(Pet.class);

        int ps = seedPetSkills(dir, petSlugToId, skillCatalogToId);
        int pl = seedPetLocations(dir, petSlugToId);
        int ec = seedEvolutionChains(dir);
        Map<String, Long> evoGroupToId = loadGroupToId();
        int es = seedEvolutionStages(dir, evoGroupToId, petCatalogToId);
        int te = seedTypeEffectiveness(dir, typeSlugToId);
        int it = seedItems(dir);
        int qs = seedQuests(dir);
        int mk = seedMarks(dir);
        int mp = seedMapPoints(dir);
        int ar = seedArticles(dir);

        log.info("[seed] 完成。types={}, skills={}, pets={}, pet_skills={}, pet_locations={}, evo_chains={}, evo_stages={}, type_eff={}, items={}, quests={}, marks={}, map_points={}, articles={}",
                t, s, p, ps, pl, ec, es, te, it, qs, mk, mp, ar);
    }

    // ====== 主表导入（TRUNCATE → 攒批 → saveBatch）======

    private int seedTypes(File dir) {
        List<Map<String, Object>> items = readItems(dir, "types.json");
        if (items.isEmpty()) return 0;
        truncate(Type.class);
        List<Type> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            Type e = new Type();
            e.setSlug(str(it.get("slug")));
            e.setName(str(it.get("name")));
            e.setNameEn(str(it.get("name_en")));
            e.setSortOrder(intOrNull(it.get("sort_order")));
            e.setSourceUrl(str(it.get("source")));
            batch.add(e);
        }
        saveBatchLog("types", batch);
        return batch.size();
    }

    private int seedSkills(File dir) {
        List<Map<String, Object>> items = readItems(dir, "skills.json");
        if (items.isEmpty()) return 0;
        truncate(Skill.class);
        List<Skill> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            Skill e = new Skill();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(str(it.get("catalog_id")));
            e.setCatalogNum(intOrNull(it.get("catalog_num")));
            e.setName(str(it.get("name")));
            e.setCategory(str(it.get("category")));
            e.setElement(str(it.get("element")));
            e.setPower(intOrNull(it.get("power")));
            e.setDamageClass(str(it.get("damage_class")));
            e.setEnergy(intOrNull(it.get("energy")));
            e.setTarget(str(it.get("target")));
            e.setEffectText(str(it.get("effect_text")));
            e.setFlavorText(str(it.get("flavor_text")));
            e.setIconId(str(it.get("icon_id")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("skills", batch);
        return batch.size();
    }

    private int seedPets(File dir, Map<String, Long> typeSlugToId) {
        List<Map<String, Object>> items = readItems(dir, "pets.json");
        if (items.isEmpty()) return 0;
        truncate(Pet.class);
        truncate(PetType.class); // pet 清了关联也得清（外键依赖）
        List<Pet> batch = new ArrayList<>(items.size());
        Map<String, List<String>> petSlugToTypeNames = new LinkedHashMap<>();
        for (Map<String, Object> it : items) {
            Pet e = new Pet();
            String slug = str(it.get("slug"));
            e.setSlug(slug);
            e.setDexNo(intOrNull(it.get("dex_no")));
            e.setCatalogId(str(it.get("catalog_id")));
            e.setName(str(it.get("name")));
            e.setTitle(str(it.get("title")));
            e.setDescription(str(it.get("description")));
            e.setCategory(str(it.get("category")));
            e.setStage(intOrNull(it.get("stage")));
            e.setBaseStats(mapStringInt(it.get("base_stats")));
            e.setHeight(str(it.get("height")));
            e.setWeight(str(it.get("weight")));
            e.setCanDoubleRide(boolOrNull(it.get("can_double_ride")));
            e.setHasShiny(boolOrNull(it.get("has_shiny")));
            e.setIllustrationKey(str(it.get("illustration_key")));
            e.setHeadKey(str(it.get("head_key")));
            e.setEggKey(str(it.get("egg_key")));
            e.setHandbookId(str(it.get("handbook_id")));
            e.setHabitat(str(it.get("habitat")));
            e.setEvolutionGroupId(str(it.get("evolution_group_id")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
            petSlugToTypeNames.put(slug, listStr(it.get("types")));
        }
        saveBatchLog("pets", batch);
        // 回查 pet slug→id，批量建 pet_type 关联
        Map<String, Long> petSlugToId = loadSlugToId(Pet.class);
        List<PetType> typeRels = new ArrayList<>();
        for (Map.Entry<String, List<String>> en : petSlugToTypeNames.entrySet()) {
            Long petId = petSlugToId.get(en.getKey());
            if (petId == null) continue;
            int slot = 1;
            for (String typeName : en.getValue()) {
                String slug = CHINESE_TYPE_TO_SLUG.get(typeName);
                Long typeId = slug != null ? typeSlugToId.get(slug) : null;
                if (typeId == null) continue;
                PetType pt = new PetType();
                pt.setPetId(petId);
                pt.setTypeId(typeId);
                pt.setSlot(slot++);
                pt.setDeleted(0);
                typeRels.add(pt);
            }
        }
        saveBatchLog("pet_type", typeRels);
        return batch.size();
    }

    private int seedPetSkills(File dir, Map<String, Long> petSlugToId, Map<String, Long> skillCatalogToId) {
        List<Map<String, Object>> items = readItems(dir, "pet_skills.json");
        if (items.isEmpty()) {
            log.info("[seed] pet_skills: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(PetSkill.class);
        List<PetSkill> batch = new ArrayList<>();
        int skip = 0;
        for (Map<String, Object> it : items) {
            Long petId = petSlugToId.get(str(it.get("pet_slug")));
            Long skillId = skillCatalogToId.get(str(it.get("skill_catalog_id")));
            if (petId == null || skillId == null) {
                skip++;
                continue;
            }
            PetSkill ps = new PetSkill();
            ps.setPetId(petId);
            ps.setSkillId(skillId);
            ps.setLearnMethod(str(it.get("learn_method")));
            ps.setUnlockLevel(intOrNull(it.get("unlock_level")));
            ps.setDeleted(0);
            batch.add(ps);
        }
        saveBatchLog("pet_skills", batch);
        log.info("[seed] pet_skills: inserted={}, skipped={}", batch.size(), skip);
        return batch.size();
    }

    private int seedPetLocations(File dir, Map<String, Long> petSlugToId) {
        List<Map<String, Object>> items = readItems(dir, "pet_locations.json");
        if (items.isEmpty()) {
            log.info("[seed] pet_locations: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(PetLocation.class);
        List<PetLocation> batch = new ArrayList<>();
        int skip = 0;
        Set<String> seen = new HashSet<>();
        for (Map<String, Object> it : items) {
            Long petId = petSlugToId.get(str(it.get("pet_slug")));
            String location = str(it.get("location"));
            if (petId == null || location == null || location.isBlank()) {
                skip++;
                continue;
            }
            if (!seen.add(petId + ":" + location)) continue;
            PetLocation pl = new PetLocation();
            pl.setPetId(petId);
            pl.setLocation(location);
            pl.setDeleted(0);
            batch.add(pl);
        }
        saveBatchLog("pet_locations", batch);
        log.info("[seed] pet_locations: inserted={}, skipped={}", batch.size(), skip);
        return batch.size();
    }

    private int seedEvolutionChains(File dir) {
        List<Map<String, Object>> items = readItems(dir, "evolution_chains.json");
        if (items.isEmpty()) return 0;
        truncate(EvolutionStage.class); // 先清 stage（外键依赖 chain）
        truncate(EvolutionChain.class);
        List<EvolutionChain> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            EvolutionChain e = new EvolutionChain();
            e.setGroupId(str(it.get("group_id")));
            e.setName(str(it.get("name")));
            e.setStageCount(intOrNull(it.get("stage_count")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("evolution_chains", batch);
        return batch.size();
    }

    private int seedEvolutionStages(File dir, Map<String, Long> groupToId, Map<String, Long> petCatalogToId) {
        List<Map<String, Object>> items = readItems(dir, "evolution_stages.json");
        if (items.isEmpty()) {
            log.info("[seed] evolution_stages: 文件缺失或为空，跳过");
            return 0;
        }
        // stage 已在 seedEvolutionChains 清空
        List<EvolutionStage> batch = new ArrayList<>();
        int skip = 0;
        for (Map<String, Object> it : items) {
            Long chainId = groupToId.get(str(it.get("group_id")));
            if (chainId == null) {
                skip++;
                continue;
            }
            String petCatalog = str(it.get("pet_catalog_id"));
            Long petId = petCatalog != null ? petCatalogToId.get(petCatalog) : null;
            EvolutionStage e = new EvolutionStage();
            e.setChainId(chainId);
            e.setStageNo(intOrNull(it.get("stage_no")));
            e.setPetId(petId);
            e.setPetCatalogId(petCatalog);
            e.setPetName(str(it.get("pet_name")));
            e.setPetTitle(str(it.get("pet_title")));
            e.setLevel(intOrNull(it.get("level")));
            e.setCond(str(it.get("cond")));
            e.setForm(str(it.get("form")));
            e.setTypes(listStr(it.get("types")));
            e.setHeadKey(str(it.get("head_key")));
            e.setIllustrationKey(str(it.get("illustration_key")));
            e.setDeleted(0);
            batch.add(e);
        }
        saveBatchLog("evolution_stages", batch);
        log.info("[seed] evolution_stages: upserted={}, skipped={}", batch.size(), skip);
        return batch.size();
    }

    private int seedTypeEffectiveness(File dir, Map<String, Long> typeSlugToId) {
        List<Map<String, Object>> items = readItems(dir, "type_effectiveness.json");
        if (items.isEmpty()) {
            log.info("[seed] type_effectiveness: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(TypeEffectiveness.class);
        List<TypeEffectiveness> batch = new ArrayList<>();
        int skip = 0;
        for (Map<String, Object> it : items) {
            Long atkId = typeSlugToId.get(str(it.get("attacking_type")));
            Long defId = typeSlugToId.get(str(it.get("defending_type")));
            if (atkId == null || defId == null) {
                skip++;
                continue;
            }
            TypeEffectiveness e = new TypeEffectiveness();
            e.setAttackingTypeId(atkId);
            e.setDefendingTypeId(defId);
            e.setMultiplier(bigDecimalOrNull(it.get("multiplier")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("type_effectiveness", batch);
        log.info("[seed] type_effectiveness: upserted={}, skipped={}", batch.size(), skip);
        return batch.size();
    }

    private int seedItems(File dir) {
        List<Map<String, Object>> items = readItems(dir, "items.json");
        if (items.isEmpty()) {
            log.info("[seed] items: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(Item.class);
        List<Item> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            Item e = new Item();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(str(it.get("catalog_id")));
            e.setName(str(it.get("name")));
            e.setRarity(str(it.get("rarity")));
            e.setMainCategory(str(it.get("main_category")));
            e.setSubCategory(str(it.get("sub_category")));
            e.setUsageText(str(it.get("usage")));
            e.setDescription(str(it.get("description")));
            e.setSourceText(str(it.get("source")));
            e.setIconId(str(it.get("icon_id")));
            e.setDataVersion(str(it.get("data_version")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("items", batch);
        return batch.size();
    }

    private int seedQuests(File dir) {
        List<Map<String, Object>> items = readItems(dir, "quests.json");
        if (items.isEmpty()) {
            log.info("[seed] quests: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(Quest.class);
        List<Quest> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            Quest e = new Quest();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(str(it.get("catalog_id")));
            e.setName(str(it.get("name")));
            e.setSeq(str(it.get("seq")));
            e.setCategory(str(it.get("category")));
            e.setLocation(str(it.get("location")));
            e.setDescription(str(it.get("description")));
            e.setReward(str(it.get("reward")));
            e.setImageKey(str(it.get("image_key")));
            e.setNote(str(it.get("note")));
            e.setAttribution(str(it.get("attribution")));
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("quests", batch);
        return batch.size();
    }

    @SuppressWarnings("unchecked")
    private int seedMarks(File dir) {
        List<Map<String, Object>> items = readItems(dir, "marks.json");
        if (items.isEmpty()) {
            log.info("[seed] marks: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(Mark.class);
        List<Mark> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            Mark e = new Mark();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(str(it.get("catalog_id")));
            e.setName(str(it.get("name")));
            e.setFaction(str(it.get("faction")));
            e.setEffectText(str(it.get("effect_text")));
            e.setMechanics(str(it.get("mechanics")));
            Object sk = it.get("source_skills");
            if (sk instanceof List<?> list && !list.isEmpty()) {
                try {
                    e.setSourceSkills(objectMapper.readValue(
                            objectMapper.writeValueAsString(list),
                            new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}));
                } catch (Exception ex) {
                    log.warn("[seed] marks: source_skills 解析失败: {}", ex.getMessage());
                }
            }
            e.setSourceUrl(str(it.get("source_url")));
            batch.add(e);
        }
        saveBatchLog("marks", batch);
        return batch.size();
    }

    private int seedMapPoints(File dir) {
        List<Map<String, Object>> items = readItems(dir, "map_points.json");
        if (items.isEmpty()) {
            log.info("[seed] map_points: 文件缺失或为空，跳过");
            return 0;
        }
        truncate(MapPoint.class);
        List<MapPoint> batch = new ArrayList<>(items.size());
        for (Map<String, Object> it : items) {
            MapPoint e = new MapPoint();
            e.setMarkType(intOrNull(it.get("mark_type")));
            e.setTypeName(str(it.get("type_name")));
            e.setTitle(str(it.get("title")));
            e.setDescription(str(it.get("desc")));
            BigDecimal lat = bigDecimalOrNull(it.get("lat"));
            BigDecimal lng = bigDecimalOrNull(it.get("lng"));
            e.setLat(lat != null ? lat.doubleValue() : null);
            e.setLng(lng != null ? lng.doubleValue() : null);
            batch.add(e);
        }
        saveBatchLog("map_points", batch);
        return batch.size();
    }

    /** 导入攻略文章：不清表（保留 AI 生成内容），按 slug upsert。 */
    private int seedArticles(File dir) {
        List<Map<String, Object>> items = readItems(dir, "articles.json");
        if (items.isEmpty()) {
            log.info("[seed] articles: 文件缺失或为空，跳过");
            return 0;
        }
        int[] counts = {0, 0};
        for (Map<String, Object> it : items) {
            String slug = str(it.get("slug"));
            Article existing = articleMapper.selectOne(
                    new LambdaQueryWrapper<Article>().eq(Article::getSlug, slug));
            Article e = existing != null ? existing : new Article();
            e.setSlug(slug);
            e.setTitle(str(it.get("title")));
            e.setSummary(str(it.get("summary")));
            e.setContent(str(it.get("content")));
            e.setCategory(str(it.get("category")));
            e.setCoverImage(str(it.get("cover_image")));
            e.setTags(listStr(it.get("tags")));
            e.setAuthorName(str(it.getOrDefault("author_name", "灵宠档案编辑部")));
            e.setStatus(str(it.getOrDefault("status", "published")));
            if (existing != null) {
                articleMapper.updateById(e);
                counts[1]++;
            } else {
                articleMapper.insert(e);
                counts[0]++;
            }
        }
        log.info("[seed] articles: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    // ====== 批量/清表工具 ======

    /**
     * 物理清空一张表（TRUNCATE ... RESTART IDENTITY CASCADE）。
     *
     * <p>用原生 SQL 而非 Db.remove：所有实体带 @TableLogic deleted，
     * BaseMapper.delete 只逻辑删除（UPDATE deleted=1），旧行仍在表里，重跑时
     * UNIQUE 约束会冲突。TRUNCATE 真正物理清空 + 重置自增序列，保证幂等。
     */
    private void truncate(Class<?> clazz) {
        String tableName = TableInfoHelper.getTableInfo(clazz).getTableName();
        jdbcTemplate.execute("TRUNCATE TABLE " + tableName + " RESTART IDENTITY CASCADE");
        log.debug("[seed] TRUNCATE {}", tableName);
    }

    /** 分批 saveBatch，每 BATCH 条一次提交，带进度日志。依赖 JDBC reWriteBatchedInserts。 */
    private <T> void saveBatchLog(String name, List<T> batch) {
        if (batch.isEmpty()) {
            log.info("[seed] {}: 0 条，跳过", name);
            return;
        }
        int total = batch.size();
        for (int i = 0; i < total; i += BATCH) {
            int end = Math.min(i + BATCH, total);
            Db.saveBatch(batch.subList(i, end));
            log.debug("[seed] {} 进度 {}/{}", name, end, total);
        }
        log.info("[seed] {}: 批量插入 {} 条", name, total);
    }

    // ====== id 映射回查（1 次往返代替 N 次 select）======

    private Map<String, Long> loadSlugToId(Class<?> clazz) {
        Map<String, Long> out = new HashMap<>();
        for (Object o : Db.list(clazz)) {
            if (o instanceof Type t) out.put(t.getSlug(), t.getId());
            else if (o instanceof Skill s) out.put(s.getSlug(), s.getId());
            else if (o instanceof Pet p) out.put(p.getSlug(), p.getId());
        }
        return out;
    }

    private Map<String, Long> loadCatalogToId(Class<?> clazz) {
        Map<String, Long> out = new HashMap<>();
        for (Object o : Db.list(clazz)) {
            if (o instanceof Skill s && s.getCatalogId() != null) out.put(s.getCatalogId(), s.getId());
            else if (o instanceof Pet p && p.getCatalogId() != null) out.put(p.getCatalogId(), p.getId());
        }
        return out;
    }

    private Map<String, Long> loadGroupToId() {
        Map<String, Long> out = new HashMap<>();
        for (EvolutionChain c : evolutionChainMapper.selectList(null)) {
            out.put(c.getGroupId(), c.getId());
        }
        return out;
    }

    // ====== 解析工具 ======

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readItems(File dir, String filename) {
        try {
            File f = new File(dir, filename);
            if (!f.isFile()) {
                log.warn("[seed] 文件缺失，跳过: {}", f.getAbsolutePath());
                return Collections.emptyList();
            }
            Map<String, Object> root = objectMapper.readValue(f, Map.class);
            Object items = root.get("items");
            log.info("[seed] 读取 {}: {} 条", filename,
                    items instanceof List ? ((List<?>) items).size() : 0);
            return items instanceof List ? (List<Map<String, Object>>) items : Collections.emptyList();
        } catch (Exception ex) {
            throw new IllegalStateException("读取 " + filename + " 失败: " + ex.getMessage(), ex);
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Integer intOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
    }

    private static Boolean boolOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(o));
    }

    private static BigDecimal bigDecimalOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal b) return b;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try { return new BigDecimal(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Integer> mapStringInt(Object o) {
        if (!(o instanceof Map<?, ?> m) || m.isEmpty()) return null;
        Map<String, Integer> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> en : m.entrySet()) {
            if (en.getValue() instanceof Number n) {
                out.put(String.valueOf(en.getKey()), n.intValue());
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<String> listStr(Object o) {
        if (!(o instanceof List<?> l)) return Collections.emptyList();
        List<String> out = new ArrayList<>(l.size());
        for (Object x : l) out.add(x == null ? null : String.valueOf(x));
        return out;
    }

    /** 中文名属性 → slug（与 scraper 的 _TYPE_PINYIN 对齐）。 */
    private static final Map<String, String> CHINESE_TYPE_TO_SLUG;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("普通", "normal"); m.put("草", "grass"); m.put("火", "fire"); m.put("水", "water");
        m.put("光", "light"); m.put("地", "ground"); m.put("冰", "ice"); m.put("龙", "dragon");
        m.put("电", "electric"); m.put("毒", "poison"); m.put("虫", "bug"); m.put("武", "fighting");
        m.put("翼", "flying"); m.put("萌", "cute"); m.put("幽", "ghost"); m.put("恶", "dark");
        m.put("机械", "machine"); m.put("幻", "illusion");
        CHINESE_TYPE_TO_SLUG = Collections.unmodifiableMap(m);
    }
}
