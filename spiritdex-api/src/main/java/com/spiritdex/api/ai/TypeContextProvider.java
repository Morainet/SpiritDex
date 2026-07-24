package com.spiritdex.api.ai;

import com.spiritdex.api.entity.Type;
import com.spiritdex.api.entity.TypeEffectiveness;
import com.spiritdex.api.mapper.TypeEffectivenessMapper;
import com.spiritdex.api.mapper.TypeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 属性相克上下文提供者：当问题涉及属性相克时，从 type_effectiveness 表组装知识注入 RAG。
 *
 * <p>精灵 embedding 不含相克关系，故问「草系被什么克制」时需单独注入相克矩阵。
 * 仅在问题命中相克关键词时触发，避免无关问题污染上下文。
 */
@Component
@RequiredArgsConstructor
public class TypeContextProvider {

    private final TypeEffectivenessMapper effectivenessMapper;
    private final TypeMapper typeMapper;

    /** 触发关键词（问题含其一即注入相克数据）。 */
    private static final List<String> KEYWORDS = List.of(
            "相克", "克制", "被克", "打谁", "克制谁", "弱点", "抗性", "倍率", "伤害倍率", "属性表"
    );

    /** 若问题涉及相克，返回格式化的相克资料；否则返回 null。 */
    public String contextFor(String question) {
        if (question == null) return null;
        boolean hit = KEYWORDS.stream().anyMatch(question::contains);
        // 也匹配「X系」+ 动词的组合，如「草系打水系」「火系弱」
        if (!hit && !question.matches(".*(草|火|水|光|地|冰|龙|电|毒|虫|武|翼|萌|幽|恶|机械|幻)系.*")) {
            return null;
        }
        return buildEffectivenessText();
    }

    /**
     * 把 type_effectiveness 表转成**双向**可读文本。
     *
     * <p>对每个属性同时给出两个视角，避免大模型从单一「攻击方视角」反推时混淆攻防方向：
     * <ul>
     *   <li>「X系作为攻击方」：用 X 系技能打谁有 2x（克制）/ 减半（不利）</li>
     *   <li>「X系作为防御方」：X 系精灵被谁打有 2x（弱点）/ 减半（抗性）</li>
     * </ul>
     * 这样无论用户问「火系被什么克制」还是「火系克制什么」，模型都能直接读到答案，
     * 无需做方向反推（glm-4-flash 等轻量模型反推常出错，把"火克草"误答成"火被草克"）。
     */
    private String buildEffectivenessText() {
        List<Type> types = typeMapper.selectList(null);
        Map<Long, String> nameById = types.stream().collect(Collectors.toMap(Type::getId, Type::getName));

        List<TypeEffectiveness> rows = effectivenessMapper.selectList(null);
        if (rows.isEmpty()) return null;

        // 攻击方分组：atkId → [(defId, mult)]
        Map<Long, List<TypeEffectiveness>> byAtk = rows.stream()
                .collect(Collectors.groupingBy(TypeEffectiveness::getAttackingTypeId));
        // 防御方分组：defId → [(atkId, mult)] —— 用于「被谁克制」视角
        Map<Long, List<TypeEffectiveness>> byDef = rows.stream()
                .collect(Collectors.groupingBy(TypeEffectiveness::getDefendingTypeId));

        StringBuilder sb = new StringBuilder();
        for (Type t : types) {
            // 视角1：X 系作为攻击方（X 系技能打别人）
            List<TypeEffectiveness> asAtk = byAtk.get(t.getId());
            if (asAtk != null && !asAtk.isEmpty()) {
                String strong = asAtk.stream()
                        .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() >= 2)
                        .map(r -> nameById.getOrDefault(r.getDefendingTypeId(), "?") + "系")
                        .collect(Collectors.joining("、"));
                String weak = asAtk.stream()
                        .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() < 1)
                        .map(r -> nameById.getOrDefault(r.getDefendingTypeId(), "?") + "系")
                        .collect(Collectors.joining("、"));
                if (!strong.isEmpty() || !weak.isEmpty()) {
                    sb.append(t.getName()).append("系作为攻击方（用").append(t.getName())
                      .append("系技能打对手）：");
                    if (!strong.isEmpty()) sb.append("克制 ").append(strong).append("（2倍伤害）");
                    if (!weak.isEmpty()) sb.append(!strong.isEmpty() ? "；" : "").append("不利 ").append(weak).append("（减半伤害）");
                    sb.append("\n");
                }
            }
            // 视角2：X 系作为防御方（X 系精灵挨打）
            List<TypeEffectiveness> asDef = byDef.get(t.getId());
            if (asDef != null && !asDef.isEmpty()) {
                String weakTo = asDef.stream()
                        .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() >= 2)
                        .map(r -> nameById.getOrDefault(r.getAttackingTypeId(), "?") + "系")
                        .collect(Collectors.joining("、"));
                String resistTo = asDef.stream()
                        .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() < 1)
                        .map(r -> nameById.getOrDefault(r.getAttackingTypeId(), "?") + "系")
                        .collect(Collectors.joining("、"));
                if (!weakTo.isEmpty() || !resistTo.isEmpty()) {
                    sb.append(t.getName()).append("系作为防御方（").append(t.getName())
                      .append("系精灵被攻击）：");
                    if (!weakTo.isEmpty()) sb.append("弱点(怕谁) ").append(weakTo).append("（受2倍伤害）");
                    if (!resistTo.isEmpty()) sb.append(!weakTo.isEmpty() ? "；" : "").append("抗性(不怕谁) ").append(resistTo).append("（受减半伤害）");
                    sb.append("\n");
                }
            }
        }
        return sb.toString();
    }
}
