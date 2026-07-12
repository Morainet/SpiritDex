package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.dto.TypeDto;
import com.spiritdex.api.dto.TypeMatrixDto;
import com.spiritdex.api.entity.Type;
import com.spiritdex.api.entity.TypeEffectiveness;
import com.spiritdex.api.mapper.TypeEffectivenessMapper;
import com.spiritdex.api.mapper.TypeMapper;
import com.spiritdex.api.util.TypeColors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TypeService {

    private final TypeMapper typeMapper;
    private final TypeEffectivenessMapper typeEffectivenessMapper;

    /** 全部属性（按 sortOrder），带配色。 */
    public List<TypeDto> listAll() {
        List<Type> types = typeMapper.selectList(
                Wrappers.<Type>lambdaQuery().orderByAsc(Type::getSortOrder));
        return types.stream().map(TypeService::toDto).toList();
    }

    /** slug → 中文名 映射（供 PetService 解析属性名）。 */
    public Map<String, String> slugToNameMap() {
        return typeMapper.selectList(null).stream()
                .collect(Collectors.toMap(Type::getSlug, Type::getName, (a, b) -> a));
    }

    /** id → slug 映射。 */
    public Map<Long, String> idToSlugMap() {
        return typeMapper.selectList(null).stream()
                .collect(Collectors.toMap(Type::getId, Type::getSlug, (a, b) -> a));
    }

    /**
     * 相克矩阵。未命中视为 1.0（仅存非 1.0 条目）。
     */
    public TypeMatrixDto getMatrix() {
        List<TypeDto> types = listAll();
        Map<Long, String> idToSlug = new HashMap<>();
        for (Type t : typeMapper.selectList(null)) {
            idToSlug.put(t.getId(), t.getSlug());
        }
        List<TypeEffectiveness> rows = typeEffectivenessMapper.selectList(null);
        Map<String, Double> multipliers = new HashMap<>();
        for (TypeEffectiveness te : rows) {
            String atk = idToSlug.get(te.getAttackingTypeId());
            String def = idToSlug.get(te.getDefendingTypeId());
            if (atk != null && def != null && te.getMultiplier() != null) {
                multipliers.put(atk + "->" + def, te.getMultiplier().doubleValue());
            }
        }
        TypeMatrixDto dto = new TypeMatrixDto();
        dto.setTypes(types);
        dto.setMultipliers(multipliers);
        return dto;
    }

    public Type getBySlug(String slug) {
        return typeMapper.selectOne(new LambdaQueryWrapper<Type>().eq(Type::getSlug, slug));
    }

    private static TypeDto toDto(Type t) {
        TypeDto d = new TypeDto();
        d.setSlug(t.getSlug());
        d.setName(t.getName());
        d.setNameEn(t.getNameEn());
        d.setSortOrder(t.getSortOrder());
        d.setColor(TypeColors.of(t.getSlug()));
        return d;
    }
}
