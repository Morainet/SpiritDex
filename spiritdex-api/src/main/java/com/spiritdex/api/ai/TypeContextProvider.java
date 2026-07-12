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

    /** 把 type_effectiveness 表转成可读文本：「草系 克制：水系(2x)、光系(2x)...；被克：火系(2x)...」。 */
    private String buildEffectivenessText() {
        List<Type> types = typeMapper.selectList(null);
        Map<Long, String> nameById = types.stream().collect(Collectors.toMap(Type::getId, Type::getName));
        Map<Long, String> slugById = types.stream().collect(Collectors.toMap(Type::getId, Type::getSlug));

        List<TypeEffectiveness> rows = effectivenessMapper.selectList(null);
        if (rows.isEmpty()) return null;

        // 按攻击方分组：atkId → [(defName, mult)]
        Map<Long, List<TypeEffectiveness>> byAtk = rows.stream()
                .collect(Collectors.groupingBy(TypeEffectiveness::getAttackingTypeId));

        StringBuilder sb = new StringBuilder();
        for (Type t : types) {
            List<TypeEffectiveness> atkRels = byAtk.get(t.getId());
            if (atkRels == null || atkRels.isEmpty()) continue;
            // 克制（mult>=2）和减半（mult<1）
            String strong = atkRels.stream()
                    .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() >= 2)
                    .map(r -> nameById.getOrDefault(r.getDefendingTypeId(), "?") + "系")
                    .collect(Collectors.joining("、"));
            String weak = atkRels.stream()
                    .filter(r -> r.getMultiplier() != null && r.getMultiplier().doubleValue() < 1)
                    .map(r -> nameById.getOrDefault(r.getDefendingTypeId(), "?") + "系")
                    .collect(Collectors.joining("、"));
            sb.append(t.getName()).append("系攻击：");
            if (!strong.isEmpty()) sb.append("克制 ").append(strong);
            if (!weak.isEmpty()) sb.append(strong.isEmpty() ? "" : "；").append("减半 ").append(weak);
            sb.append("\n");
        }
        return sb.toString();
    }
}
