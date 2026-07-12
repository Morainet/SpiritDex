package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.entity.PetType;
import com.spiritdex.api.entity.Type;
import com.spiritdex.api.entity.TypeEffectiveness;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetTypeMapper;
import com.spiritdex.api.mapper.TypeEffectivenessMapper;
import com.spiritdex.api.mapper.TypeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 数据分析服务：把 SpiritDex 的结构化数据变成「计算结果」，作为 AI 攻略的差异化素材。
 *
 * <p>这是 SpiritDex 区别于 BWIKI（静态百科）的核心能力——BWIKI 只能告诉你活动 boss 是什么属性，
 * 本服务能<b>扫全库算出最佳打手、奖励精灵评级、每周培养优先级</b>，这些是 BWIKI 永远做不到的计算型内容。
 *
 * <p>三个核心能力：
 * <ol>
 *   <li>{@link #analyzeCounters} —— 给定 boss 属性，扫全库找克制精灵，按相克倍率×种族值排序</li>
 *   <li>{@link #evaluatePet} —— 给定精灵 slug，查种族值/技能/进化，输出练度评级上下文</li>
 *   <li>{@link #weeklyTrainingBoard} —— 按综合实力扫全库，输出本周培养 Top N（不依赖活动源）</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityAnalysisService {

    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final TypeMapper typeMapper;
    private final TypeEffectivenessMapper effectivenessMapper;

    /** 打手分析结果（可被 prompt 消费，也可被 DTO 序列化）。 */
    public record CounterAnalysis(
            String bossTypeText,
            List<CounterPick> topCounters,
            int totalScanned
    ) {
    }

    /** 单个推荐打手。 */
    public record CounterPick(
            String slug, String name, List<String> types,
            double bestMultiplier, int totalStats, Integer stage
    ) {
    }

    /** 精灵评级结果。 */
    public record PetEvaluation(
            String slug, String name, List<String> types, Integer totalStats,
            Integer stage, String rarity, String obtainMethods,
            String tierSuggestion
    ) {
    }

    /** 培养榜条目。 */
    public record TrainingPick(
            String slug, String name, List<String> types,
            int totalStats, Integer stage, String reason
    ) {
    }

    /**
     * 打手分析：给定 boss 的属性中文名列表（如 ["暗","龙"]），扫全库找克制精灵。
     *
     * <p>算法：
     * <ol>
     *   <li>boss 属性 → 反查 type_effectiveness，找出所有「攻击这些属性 ≥2x」的攻击属性</li>
     *   <li>扫 671 只精灵，凡带这些攻击属性的就是候选打手</li>
     *   <li>每只取其攻击属性对 boss 的最高倍率，乘以种族值总分排序</li>
     * </ol>
     *
     * @param bossTypeNames boss 属性中文名（如 ["暗","龙"]）；为空返回空结果
     * @param topN          返回前 N 个
     */
    public CounterAnalysis analyzeCounters(List<String> bossTypeNames, int topN) {
        if (bossTypeNames == null || bossTypeNames.isEmpty()) {
            return new CounterAnalysis("（未指定 boss 属性）", List.of(), 0);
        }

        List<Type> allTypes = typeMapper.selectList(null);
        Map<String, Long> typeIdByName = new HashMap<>();
        Map<Long, String> typeNameById = new HashMap<>();
        for (Type t : allTypes) {
            typeIdByName.put(t.getName(), t.getId());
            typeNameById.put(t.getId(), t.getName());
        }

        // boss 属性 id 集合
        Set<Long> bossTypeIds = new HashSet<>();
        for (String name : bossTypeNames) {
            Long id = typeIdByName.get(name);
            if (id != null) bossTypeIds.add(id);
        }
        if (bossTypeIds.isEmpty()) {
            return new CounterAnalysis(String.join("/", bossTypeNames) + "（未识别）", List.of(), 0);
        }

        // 反查：哪些攻击属性对这些 boss 属性 ≥2x
        // type_effectiveness 只存非 1.0 条目，multiplier >= 2 即克制
        List<TypeEffectiveness> allEff = effectivenessMapper.selectList(null);
        Map<Long, Double> atkTypeBestMult = new HashMap<>(); // 攻击属性id → 对 boss 的最高倍率
        for (TypeEffectiveness eff : allEff) {
            if (bossTypeIds.contains(eff.getDefendingTypeId())
                    && eff.getMultiplier() != null
                    && eff.getMultiplier().compareTo(BigDecimal.ONE) > 0) {
                double mult = eff.getMultiplier().doubleValue();
                atkTypeBestMult.merge(eff.getAttackingTypeId(), mult, Math::max);
            }
        }

        // 哪些攻击属性能克制 boss
        Set<Long> counterAtkTypeIds = atkTypeBestMult.keySet();
        String bossTypeText = bossTypeNames.stream()
                .map(n -> n.endsWith("系") ? n : n + "系")
                .collect(Collectors.joining("/"));

        if (counterAtkTypeIds.isEmpty()) {
            // 无相克数据：降级为按种族值推荐
            log.warn("[analysis] 无相克数据命中 boss 属性 {}，降级为种族值推荐", bossTypeText);
            return new CounterAnalysis(bossTypeText, List.of(), 0);
        }

        // 扫全库精灵，找带克制攻击属性的
        List<Pet> allPets = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getBaseStats)
                .orderByDesc(Pet::getDexNo));
        Map<Long, List<Long>> petToTypeIds = loadPetTypeIds(allPets);

        List<CounterPick> picks = new ArrayList<>();
        for (Pet p : allPets) {
            List<Long> petTypes = petToTypeIds.getOrDefault(p.getId(), List.of());
            // 这只精灵的攻击属性里，有没有克 boss 的？取最高倍率
            double bestMult = 0;
            for (Long tid : petTypes) {
                Double m = atkTypeBestMult.get(tid);
                if (m != null && m > bestMult) bestMult = m;
            }
            if (bestMult <= 0) continue; // 不克制，跳过
            int total = totalStats(p);
            if (total <= 0) continue;
            List<String> typeNames = petTypes.stream()
                    .map(typeNameById::get).filter(java.util.Objects::nonNull)
                    .collect(Collectors.toList());
            picks.add(new CounterPick(p.getSlug(), p.getName(), typeNames, bestMult, total, p.getStage()));
        }

        // 排序：倍率高优先，倍率相同按种族值
        picks.sort(Comparator.comparingDouble(CounterPick::bestMultiplier).reversed()
                .thenComparingInt(CounterPick::totalStats).reversed());
        List<CounterPick> top = picks.size() > topN ? picks.subList(0, topN) : picks;
        log.info("[analysis] 打手分析 boss={} 命中 {} 只，取 Top{}", bossTypeText, picks.size(), top.size());
        return new CounterAnalysis(bossTypeText, top, allPets.size());
    }

    /**
     * 精灵评级：给定 slug，组装种族值/技能/进化潜力上下文 + 练度建议。
     * 不直接评级（留给 AI 综合），但给出结构化数据 + 粗分 tier 供 prompt 参考。
     */
    public PetEvaluation evaluatePet(String slug) {
        Pet p = petMapper.selectOne(Wrappers.<Pet>lambdaQuery().eq(Pet::getSlug, slug));
        if (p == null) return null;
        List<String> typeNames = loadTypeNames(List.of(p.getId())).getOrDefault(p.getId(), List.of());
        int total = totalStats(p);
        String tier = tierByStats(total, p.getStage());
        String obtain = p.getObtainMethods() == null ? null : String.join("、", p.getObtainMethods());
        return new PetEvaluation(
                p.getSlug(), p.getName(), typeNames, total,
                p.getStage(), p.getRarity(), obtain, tier
        );
    }

    /**
     * 每周培养榜：不依赖活动源，按综合实力扫全库输出 Top N。
     * 这是 BWIKI 完全空白的内容（百科不写"这周练谁"）。
     *
     * <p>评分：种族值总分为主，进化阶段（3阶 > 2阶）加权，稀有度小幅加权。
     * 这是简化启发式——目的是产出"有理有据的推荐"，不是绝对最优解。
     */
    public List<TrainingPick> weeklyTrainingBoard(int topN) {
        List<Pet> allPets = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getBaseStats));
        Map<Long, List<String>> typeNames = loadTypeNames(
                allPets.stream().map(Pet::getId).toList());

        record Scored(Pet pet, int score, String reason) {
        }
        List<Scored> scored = new ArrayList<>();
        for (Pet p : allPets) {
            int total = totalStats(p);
            if (total <= 0) continue;
            int score = total;
            StringBuilder reason = new StringBuilder("种族值 " + total);
            if (p.getStage() != null && p.getStage() >= 3) {
                score += 30;
                reason.append("，三阶完全体");
            } else if (p.getStage() != null && p.getStage() == 2) {
                score += 15;
                reason.append("，二阶形态");
            }
            if ("传说".equals(p.getRarity()) || "神兽".equals(p.getRarity())) {
                score += 20;
                reason.append("，").append(p.getRarity()).append("级");
            }
            scored.add(new Scored(p, score, reason.toString()));
        }
        scored.sort(Comparator.comparingInt(Scored::score).reversed());
        List<Scored> top = scored.size() > topN ? scored.subList(0, topN) : scored;
        return top.stream().map(s -> new TrainingPick(
                s.pet().getSlug(), s.pet().getName(),
                typeNames.getOrDefault(s.pet().getId(), List.of()),
                totalStats(s.pet()),
                s.pet().getStage(), s.reason()
        )).toList();
    }

    // ====== 工具 ======

    /** 把 CounterAnalysis 渲染成 prompt 可用的 Markdown 文本。 */
    public static String renderCounters(CounterAnalysis a) {
        if (a == null || a.topCounters() == null || a.topCounters().isEmpty()) {
            return "（暂无相克数据，无法计算打手推荐）";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Boss 属性：").append(a.bossTypeText())
                .append("（扫描 ").append(a.totalScanned()).append(" 只精灵）\n");
        sb.append("计算得出的最佳打手 Top").append(a.topCounters().size()).append("：\n");
        for (int i = 0; i < a.topCounters().size(); i++) {
            CounterPick c = a.topCounters().get(i);
            sb.append(i + 1).append(". **").append(c.name()).append("**（")
                    .append(String.join("/", c.types())).append("系）")
                    .append(" — 克制倍率 ").append(formatMult(c.bestMultiplier()))
                    .append("，种族值 ").append(c.totalStats());
            if (c.stage() != null) sb.append("，").append(c.stage()).append("阶");
            // 站内链接（前端识别 /pets/slug 渲染为精灵卡）
            sb.append(" → 详情 [/pets/").append(c.slug()).append("](/pets/").append(c.slug()).append(")\n");
        }
        return sb.toString();
    }

    /** 把 PetEvaluation 渲染成 prompt 可用文本。 */
    public static String renderEvaluation(PetEvaluation e) {
        if (e == null) return "（精灵数据缺失）";
        StringBuilder sb = new StringBuilder();
        sb.append("**").append(e.name()).append("**（")
                .append(e.types().isEmpty() ? "未知" : String.join("/", e.types()) + "系").append("）");
        if (e.totalStats() != null) sb.append(" 种族值总分 ").append(e.totalStats());
        if (e.stage() != null) sb.append("，").append(e.stage()).append("阶完全体");
        if (e.rarity() != null) sb.append("，稀有度 ").append(e.rarity());
        if (e.obtainMethods() != null) sb.append("，获取：").append(e.obtainMethods());
        sb.append(" → 建议评级：").append(e.tierSuggestion());
        sb.append(" → 详情 [/pets/").append(e.slug()).append("](/pets/").append(e.slug()).append(")");
        return sb.toString();
    }

    /** 把培养榜渲染成 prompt 可用 Markdown。 */
    public static String renderBoard(List<TrainingPick> board) {
        if (board == null || board.isEmpty()) return "（无可用精灵数据）";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < board.size(); i++) {
            TrainingPick t = board.get(i);
            sb.append(i + 1).append(". **").append(t.name()).append("**（")
                    .append(t.types().isEmpty() ? "未知" : String.join("/", t.types()) + "系").append("）")
                    .append(" — ").append(t.reason());
            sb.append(" → [/pets/").append(t.slug()).append("](/pets/").append(t.slug()).append(")\n");
        }
        return sb.toString();
    }

    /** 种族值总分（baseStats 各项之和）。 */
    private static int totalStats(Pet p) {
        if (p.getBaseStats() == null) return 0;
        return p.getBaseStats().values().stream().mapToInt(Integer::intValue).sum();
    }

    /** 按种族值总分粗分 tier（仅 prompt 参考，最终评级由 AI 综合给出）。 */
    private static String tierByStats(int total, Integer stage) {
        if (total >= 600) return "T0（顶级，强烈推荐投入）";
        if (total >= 530) return "T1（强力，值得培养）";
        if (total >= 460) return "T2（中坚，特定场景有用）";
        return "T3（一般，新手期过渡）";
    }

    private static String formatMult(double m) {
        if (m == (int) m) return (int) m + "x";
        return m + "x";
    }

    /** 批量加载 petId → 属性id 列表（按 slot 排序）。 */
    private Map<Long, List<Long>> loadPetTypeIds(List<Pet> pets) {
        if (pets.isEmpty()) return Map.of();
        List<PetType> rels = petTypeMapper.selectList(Wrappers.<PetType>lambdaQuery()
                .in(PetType::getPetId, pets.stream().map(Pet::getId).toList())
                .orderByAsc(PetType::getSlot));
        Map<Long, List<Long>> out = new LinkedHashMap<>();
        for (PetType r : rels) {
            out.computeIfAbsent(r.getPetId(), k -> new ArrayList<>()).add(r.getTypeId());
        }
        return out;
    }

    /** 批量加载 petId → 属性名列表。 */
    private Map<Long, List<String>> loadTypeNames(List<Long> petIds) {
        if (petIds.isEmpty()) return Map.of();
        List<PetType> rels = petTypeMapper.selectList(Wrappers.<PetType>lambdaQuery()
                .in(PetType::getPetId, petIds).orderByAsc(PetType::getSlot));
        if (rels.isEmpty()) return Map.of();
        Map<Long, Type> typeById = typeMapper.selectBatchIds(
                rels.stream().map(PetType::getTypeId).distinct().toList())
                .stream().collect(Collectors.toMap(Type::getId, t -> t));
        Map<Long, List<String>> out = new LinkedHashMap<>();
        for (PetType r : rels) {
            Type t = typeById.get(r.getTypeId());
            if (t != null) out.computeIfAbsent(r.getPetId(), k -> new ArrayList<>()).add(t.getName());
        }
        return out;
    }
}
