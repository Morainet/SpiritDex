package com.spiritdex.api.seed;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spiritdex.api.entity.*;
import com.spiritdex.api.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.*;

/**
 * Phase 1 数据导入：读取 data/seed/*.json，按唯一键 upsert 入库。
 *
 * <p>仅在 {@code seed} profile 下激活，避免正常启动重跑全量入库：
 * <pre>{@code
 * mvn spring-boot:run -Dspring-boot.run.profiles=seed
 * }</pre>
 *
 * <p>导入顺序（满足外键依赖）：types → skills → pets(+pet_type) → pet_skill →
 * evolution_chains → evolution_stages。upsert 策略：按唯一键查存在→update，否则 insert。
 */
@Slf4j
@Component
@Profile("seed")
@RequiredArgsConstructor
public class SeedRunner implements CommandLineRunner {

    private final ObjectMapper objectMapper;
    private final SeedProperties props;

    private final TypeMapper typeMapper;
    private final SkillMapper skillMapper;
    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final PetSkillMapper petSkillMapper;
    private final EvolutionChainMapper evolutionChainMapper;
    private final EvolutionStageMapper evolutionStageMapper;
    private final TypeEffectivenessMapper typeEffectivenessMapper;
    private final ArticleMapper articleMapper;
    private final ItemMapper itemMapper;
    private final QuestMapper questMapper;
    private final MarkMapper markMapper;

    /** batch flush 大小。 */
    private static final int BATCH = 100;

    // ====== 运行入口 ======

    @Override
    public void run(String... args) {
        File dir = new File(props.getDir());
        if (!dir.isDirectory()) {
            throw new IllegalStateException("seed 目录不存在: " + dir.getAbsolutePath()
                    + "（请先运行 scraper/main.py 生成 data/seed/*.json）");
        }
        log.info("[seed] 开始导入，目录: {}", dir.getAbsolutePath());

        // 缓存：catalog_id/slug → 主键 id，供关联表解析外键
        Map<String, Long> typeSlugToId = new HashMap<>();
        Map<String, Long> skillCatalogToId = new HashMap<>();
        Map<String, Long> petSlugToId = new HashMap<>();
        Map<String, Long> petCatalogToId = new HashMap<>();
        Map<String, Long> evoGroupToId = new HashMap<>();

        int t = seedTypes(dir, typeSlugToId);
        int s = seedSkills(dir, skillCatalogToId);
        int p = seedPets(dir, typeSlugToId, petSlugToId, petCatalogToId);
        int ps = seedPetSkills(dir, petSlugToId, skillCatalogToId);
        int ec = seedEvolutionChains(dir, evoGroupToId);
        int es = seedEvolutionStages(dir, evoGroupToId, petCatalogToId);
        int te = seedTypeEffectiveness(dir, typeSlugToId);
        int it = seedItems(dir);
        int qs = seedQuests(dir);
        int mk = seedMarks(dir);
        int ar = seedArticles(dir);

        log.info("[seed] 完成。types={}, skills={}, pets={}, pet_skills={}, evo_chains={}, evo_stages={}, type_eff={}, items={}, quests={}, marks={}, articles={}",
                t, s, p, ps, ec, es, te, it, qs, mk, ar);
    }

    // ====== 各实体导入 ======

    private int seedTypes(File dir, Map<String, Long> slugToId) {
        List<Map<String, Object>> items = readItems(dir, "types.json");
        int[] counts = {0, 0}; // insert, update
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String slug = str(it.get("slug"));
            Type existing = typeMapper.selectOne(new LambdaQueryWrapper<Type>().eq(Type::getSlug, slug));
            Type e = existing != null ? existing : new Type();
            e.setSlug(slug);
            e.setName(str(it.get("name")));
            e.setNameEn(str(it.get("name_en")));
            e.setSortOrder(intOrNull(it.get("sort_order")));
            e.setSourceUrl(str(it.get("source")));
            if (existing != null) {
                typeMapper.updateById(e);
                counts[1]++;
            } else {
                typeMapper.insert(e);
                counts[0]++;
            }
            slugToId.put(slug, e.getId());
            flushIfBatch(i, items.size());
        }
        log.info("[seed] types: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    private int seedSkills(File dir, Map<String, Long> catalogToId) {
        List<Map<String, Object>> items = readItems(dir, "skills.json");
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String catalogId = str(it.get("catalog_id"));
            Skill existing = skillMapper.selectOne(new LambdaQueryWrapper<Skill>().eq(Skill::getCatalogId, catalogId));
            Skill e = existing != null ? existing : new Skill();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(catalogId);
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
            save(skillMapper, e, existing, counts);
            catalogToId.put(catalogId, e.getId());
            flushIfBatch(i, items.size());
        }
        log.info("[seed] skills: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    private int seedPets(File dir, Map<String, Long> typeSlugToId,
                         Map<String, Long> petSlugToId, Map<String, Long> petCatalogToId) {
        List<Map<String, Object>> items = readItems(dir, "pets.json");
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String slug = str(it.get("slug"));
            Pet existing = petMapper.selectOne(new LambdaQueryWrapper<Pet>().eq(Pet::getSlug, slug));
            Pet e = existing != null ? existing : new Pet();
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
            save(petMapper, e, existing, counts);
            petSlugToId.put(slug, e.getId());
            if (e.getCatalogId() != null) {
                petCatalogToId.put(e.getCatalogId(), e.getId());
            }
            // 关联属性
            upsertPetTypes(e.getId(), typeSlugToId, listStr(it.get("types")));
            flushIfBatch(i, items.size());
        }
        log.info("[seed] pets: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    private void upsertPetTypes(Long petId, Map<String, Long> typeSlugToId, List<String> typeSlugs) {
        // 物理删除旧关联（逻辑删会残留行，触发唯一约束冲突），再按 seed 重建，保证幂等
        petTypeMapper.physicalDeleteByPet(petId);
        int slot = 1;
        for (String typeName : typeSlugs) {
            // typeSlugs 实际存的是中文名（草/水），需映射回 slug
            String slug = CHINESE_TYPE_TO_SLUG.get(typeName);
            Long typeId = slug != null ? typeSlugToId.get(slug) : null;
            if (typeId == null) {
                continue;
            }
            PetType pt = new PetType();
            pt.setPetId(petId);
            pt.setTypeId(typeId);
            pt.setSlot(slot++);
            pt.setDeleted(0);
            petTypeMapper.insert(pt);
        }
    }

    private int seedPetSkills(File dir, Map<String, Long> petSlugToId, Map<String, Long> skillCatalogToId) {
        List<Map<String, Object>> items = readItems(dir, "pet_skills.json");
        int ok = 0, skip = 0;
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            Long petId = petSlugToId.get(str(it.get("pet_slug")));
            Long skillId = skillCatalogToId.get(str(it.get("skill_catalog_id")));
            if (petId == null || skillId == null) {
                skip++;
                continue;
            }
            // 幂等：物理删旧（含逻辑删行）再插，避免唯一约束冲突
            petSkillMapper.physicalDelete(petId, skillId);
            PetSkill ps = new PetSkill();
            ps.setPetId(petId);
            ps.setSkillId(skillId);
            ps.setLearnMethod(str(it.get("learn_method")));
            ps.setUnlockLevel(intOrNull(it.get("unlock_level")));
            ps.setDeleted(0);
            petSkillMapper.insert(ps);
            ok++;
            flushIfBatch(i, items.size());
        }
        log.info("[seed] pet_skills: inserted={}, skipped={}", ok, skip);
        return ok;
    }

    private int seedEvolutionChains(File dir, Map<String, Long> groupToId) {
        List<Map<String, Object>> items = readItems(dir, "evolution_chains.json");
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String groupId = str(it.get("group_id"));
            EvolutionChain existing = evolutionChainMapper.selectOne(
                    new LambdaQueryWrapper<EvolutionChain>().eq(EvolutionChain::getGroupId, groupId));
            EvolutionChain e = existing != null ? existing : new EvolutionChain();
            e.setGroupId(groupId);
            e.setName(str(it.get("name")));
            e.setStageCount(intOrNull(it.get("stage_count")));
            e.setSourceUrl(str(it.get("source_url")));
            save(evolutionChainMapper, e, existing, counts);
            groupToId.put(groupId, e.getId());
            flushIfBatch(i, items.size());
        }
        log.info("[seed] evolution_chains: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    private int seedEvolutionStages(File dir, Map<String, Long> groupToId, Map<String, Long> petCatalogToId) {
        List<Map<String, Object>> items = readItems(dir, "evolution_stages.json");
        int ok = 0, skip = 0;
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            Long chainId = groupToId.get(str(it.get("group_id")));
            if (chainId == null) {
                skip++;
                continue;
            }
            String petCatalog = str(it.get("pet_catalog_id"));
            Long petId = petCatalog != null ? petCatalogToId.get(petCatalog) : null;
            Integer stageNo = intOrNull(it.get("stage_no"));
            // 幂等：物理删旧（含逻辑删行）再插，避免 (chain_id, stage_no) 唯一约束冲突
            evolutionStageMapper.physicalDelete(chainId, stageNo);
            EvolutionStage e = new EvolutionStage();
            e.setChainId(chainId);
            e.setStageNo(stageNo);
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
            evolutionStageMapper.insert(e);
            ok++;
            flushIfBatch(i, items.size());
        }
        log.info("[seed] evolution_stages: upserted={}, skipped={}", ok, skip);
        return ok;
    }

    /**
     * 导入属性相克矩阵。文件可空（items 为空）——结构先搭好，数据后续填充。
     * 每条：{attacking_type, defending_type, multiplier}，type 用 slug（草/fire...）。
     */
    private int seedTypeEffectiveness(File dir, Map<String, Long> typeSlugToId) {
        List<Map<String, Object>> items = readItems(dir, "type_effectiveness.json");
        if (items.isEmpty()) {
            log.info("[seed] type_effectiveness: 文件缺失或为空，跳过（结构已建，待数据填充）");
            return 0;
        }
        int ok = 0, skip = 0;
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            Long atkId = typeSlugToId.get(str(it.get("attacking_type")));
            Long defId = typeSlugToId.get(str(it.get("defending_type")));
            if (atkId == null || defId == null) {
                skip++;
                continue;
            }
            TypeEffectiveness existing = typeEffectivenessMapper.selectOne(
                    new LambdaQueryWrapper<TypeEffectiveness>()
                            .eq(TypeEffectiveness::getAttackingTypeId, atkId)
                            .eq(TypeEffectiveness::getDefendingTypeId, defId));
            TypeEffectiveness e = existing != null ? existing : new TypeEffectiveness();
            e.setAttackingTypeId(atkId);
            e.setDefendingTypeId(defId);
            e.setMultiplier(bigDecimalOrNull(it.get("multiplier")));
            e.setSourceUrl(str(it.get("source_url")));
            if (existing != null) {
                typeEffectivenessMapper.updateById(e);
            } else {
                typeEffectivenessMapper.insert(e);
            }
            ok++;
            flushIfBatch(i, items.size());
        }
        log.info("[seed] type_effectiveness: upserted={}, skipped={}", ok, skip);
        return ok;
    }

    /** 导入道具图鉴（按 catalog_id upsert，纯展示无关联）。 */
    private int seedItems(File dir) {
        List<Map<String, Object>> items = readItems(dir, "items.json");
        if (items.isEmpty()) {
            log.info("[seed] items: 文件缺失或为空，跳过");
            return 0;
        }
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String catalogId = str(it.get("catalog_id"));
            Item existing = itemMapper.selectOne(
                    new LambdaQueryWrapper<Item>().eq(Item::getCatalogId, catalogId));
            Item e = existing != null ? existing : new Item();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(catalogId);
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
            save(itemMapper, e, existing, counts);
            flushIfBatch(i, items.size());
        }
        log.info("[seed] items: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    /** 导入任务图鉴（按 catalog_id upsert，纯展示无关联）。 */
    private int seedQuests(File dir) {
        List<Map<String, Object>> items = readItems(dir, "quests.json");
        if (items.isEmpty()) {
            log.info("[seed] quests: 文件缺失或为空，跳过");
            return 0;
        }
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String catalogId = str(it.get("catalog_id"));
            Quest existing = questMapper.selectOne(
                    new LambdaQueryWrapper<Quest>().eq(Quest::getCatalogId, catalogId));
            Quest e = existing != null ? existing : new Quest();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(catalogId);
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
            save(questMapper, e, existing, counts);
            flushIfBatch(i, items.size());
        }
        log.info("[seed] quests: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    /** 导入印记图鉴（按 catalog_id upsert）。source_skills 是 JSONB 列表，用 ObjectMapper 反序列化。 */
    @SuppressWarnings("unchecked")
    private int seedMarks(File dir) {
        List<Map<String, Object>> items = readItems(dir, "marks.json");
        if (items.isEmpty()) {
            log.info("[seed] marks: 文件缺失或为空，跳过");
            return 0;
        }
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            String catalogId = str(it.get("catalog_id"));
            Mark existing = markMapper.selectOne(
                    new LambdaQueryWrapper<Mark>().eq(Mark::getCatalogId, catalogId));
            Mark e = existing != null ? existing : new Mark();
            e.setSlug(str(it.get("slug")));
            e.setCatalogId(catalogId);
            e.setName(str(it.get("name")));
            e.setFaction(str(it.get("faction")));
            e.setEffectText(str(it.get("effect_text")));
            e.setMechanics(str(it.get("mechanics")));
            // source_skills：JSONB 列表 [{name, desc}]，用 ObjectMapper 转 List<Map>
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
            save(markMapper, e, existing, counts);
            flushIfBatch(i, items.size());
        }
        log.info("[seed] marks: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    /** 导入攻略文章（Markdown 正文，按 slug upsert）。 */
    private int seedArticles(File dir) {
        List<Map<String, Object>> items = readItems(dir, "articles.json");
        if (items.isEmpty()) {
            log.info("[seed] articles: 文件缺失或为空，跳过");
            return 0;
        }
        int[] counts = {0, 0};
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
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
            save(articleMapper, e, existing, counts);
            flushIfBatch(i, items.size());
        }
        log.info("[seed] articles: insert={}, update={}", counts[0], counts[1]);
        return items.size();
    }

    // ====== 工具 ======

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

    private <T> void save(com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper,
                          T entity, T existing, int[] counts) {
        if (existing != null) {
            mapper.updateById(entity);
            counts[1]++;
        } else {
            mapper.insert(entity);
            counts[0]++;
        }
    }

    private void flushIfBatch(int i, int total) {
        if ((i + 1) % BATCH == 0) {
            log.debug("[seed] 进度 {}/{}", i + 1, total);
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

    private static java.math.BigDecimal bigDecimalOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof java.math.BigDecimal b) return b;
        if (o instanceof Number n) return java.math.BigDecimal.valueOf(n.doubleValue());
        try { return new java.math.BigDecimal(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
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
