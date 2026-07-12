package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.*;
import com.spiritdex.api.entity.*;
import com.spiritdex.api.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PetService extends ServiceImpl<PetMapper, Pet> {

    private final PetTypeMapper petTypeMapper;
    private final PetSkillMapper petSkillMapper;
    private final SkillMapper skillMapper;
    private final TypeMapper typeMapper;
    private final EvolutionChainMapper evolutionChainMapper;
    private final EvolutionStageMapper evolutionStageMapper;
    private final TypeService typeService;

    // ====== 列表筛选 ======

    /**
     * 分页筛选：type(slug) / stage / q(名字模糊) → PageResult。
     */
    public PageResult<PetListItemDto> search(String typeSlug, Integer stage, String q, int page, int size) {
        // 若指定 type，先解出 typeId，再用 pet_type 关联
        Set<Long> petIdsByType = null;
        if (typeSlug != null && !typeSlug.isBlank()) {
            Type type = typeService.getBySlug(typeSlug);
            if (type == null) {
                return PageResult.of(List.of(), 0, page, size);
            }
            petIdsByType = petTypeMapper.selectList(
                            Wrappers.<PetType>lambdaQuery().eq(PetType::getTypeId, type.getId()))
                    .stream().map(PetType::getPetId).collect(Collectors.toSet());
            if (petIdsByType.isEmpty()) {
                return PageResult.of(List.of(), 0, page, size);
            }
        }

        LambdaQueryWrapper<Pet> w = Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getDexNo)
                .orderByAsc(Pet::getDexNo);
        if (stage != null) {
            w.eq(Pet::getStage, stage);
        }
        if (q != null && !q.isBlank()) {
            w.like(Pet::getName, q.trim());
        }
        if (petIdsByType != null) {
            w.in(Pet::getId, petIdsByType);
        }

        IPage<Pet> p = page(new Page<>(page, size), w);
        List<Pet> records = p.getRecords();
        Map<Long, List<String>> typesByPetId = loadTypeNamesFor(records);
        List<PetListItemDto> list = records.stream().map(pet -> {
            PetListItemDto d = toListItem(pet);
            d.setTypes(typesByPetId.getOrDefault(pet.getId(), List.of()));
            return d;
        }).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    // ====== 详情聚合 ======

    public PetDetailDto getDetail(String slug) {
        Pet pet = getOne(new LambdaQueryWrapper<Pet>().eq(Pet::getSlug, slug));
        if (pet == null) {
            throw new BizException(4040, "精灵不存在: " + slug);
        }
        PetDetailDto d = new PetDetailDto();
        d.setSlug(pet.getSlug());
        d.setDexNo(pet.getDexNo());
        d.setName(pet.getName());
        d.setTitle(pet.getTitle());
        d.setDescription(pet.getDescription());
        d.setCategory(pet.getCategory());
        d.setStage(pet.getStage());
        d.setBaseStats(pet.getBaseStats());
        d.setHeight(pet.getHeight());
        d.setWeight(pet.getWeight());
        d.setCanDoubleRide(pet.getCanDoubleRide());
        d.setHasShiny(pet.getHasShiny());
        d.setHabitat(pet.getHabitat());
        d.setIllustrationKey(pet.getIllustrationKey());
        d.setHeadKey(pet.getHeadKey());
        d.setEvolutionGroupId(pet.getEvolutionGroupId());

        d.setTypes(typesOf(pet.getId()));
        d.setSkills(skillsOf(pet.getId()));
        d.setEvolution(evolutionOf(pet.getEvolutionGroupId()));
        return d;
    }

    // 兼容旧接口（Phase 0）：返回实体
    public Pet getBySlug(String slug) {
        Pet pet = getOne(new LambdaQueryWrapper<Pet>().eq(Pet::getSlug, slug));
        if (pet == null) {
            throw new BizException(4040, "精灵不存在: " + slug);
        }
        return pet;
    }

    // ====== 关联数据加载 ======

    private List<String> typesOf(Long petId) {
        List<PetType> rels = petTypeMapper.selectList(
                Wrappers.<PetType>lambdaQuery().eq(PetType::getPetId, petId).orderByAsc(PetType::getSlot));
        if (rels.isEmpty()) return List.of();
        Map<Long, Type> typeById = typeMapper.selectBatchIds(rels.stream().map(PetType::getTypeId).toList())
                .stream().collect(Collectors.toMap(Type::getId, t -> t));
        return rels.stream()
                .map(r -> typeById.get(r.getTypeId()))
                .filter(Objects::nonNull)
                .map(Type::getName)
                .toList();
    }

    private Map<Long, List<String>> loadTypeNamesFor(List<Pet> pets) {
        if (pets.isEmpty()) return Map.of();
        List<Long> petIds = pets.stream().map(Pet::getId).toList();
        List<PetType> rels = petTypeMapper.selectList(
                Wrappers.<PetType>lambdaQuery().in(PetType::getPetId, petIds).orderByAsc(PetType::getSlot));
        if (rels.isEmpty()) return Map.of();
        Map<Long, Type> typeById = typeMapper.selectBatchIds(rels.stream().map(PetType::getTypeId).distinct().toList())
                .stream().collect(Collectors.toMap(Type::getId, t -> t));
        Map<Long, List<String>> out = new HashMap<>();
        for (PetType r : rels) {
            Type t = typeById.get(r.getTypeId());
            if (t != null) {
                out.computeIfAbsent(r.getPetId(), k -> new ArrayList<>()).add(t.getName());
            }
        }
        return out;
    }

    private List<PetSkillDto> skillsOf(Long petId) {
        List<PetSkill> rels = petSkillMapper.selectList(
                Wrappers.<PetSkill>lambdaQuery().eq(PetSkill::getPetId, petId));
        if (rels.isEmpty()) return List.of();
        Map<Long, Skill> skillById = skillMapper.selectBatchIds(rels.stream().map(PetSkill::getSkillId).toList())
                .stream().collect(Collectors.toMap(Skill::getId, s -> s));
        List<PetSkillDto> out = new ArrayList<>();
        for (PetSkill r : rels) {
            Skill s = skillById.get(r.getSkillId());
            if (s == null) continue;
            PetSkillDto d = new PetSkillDto();
            d.setSlug(s.getSlug());
            d.setName(s.getName());
            d.setCategory(s.getCategory());
            d.setElement(s.getElement());
            d.setPower(s.getPower());
            d.setDamageClass(s.getDamageClass());
            d.setEnergy(s.getEnergy());
            d.setTarget(s.getTarget());
            d.setEffectText(s.getEffectText());
            d.setLearnMethod(r.getLearnMethod());
            d.setUnlockLevel(r.getUnlockLevel());
            out.add(d);
        }
        return out;
    }

    private EvolutionChainDto evolutionOf(String groupId) {
        if (groupId == null || groupId.isBlank()) return null;
        EvolutionChain chain = evolutionChainMapper.selectOne(
                Wrappers.<EvolutionChain>lambdaQuery().eq(EvolutionChain::getGroupId, groupId));
        if (chain == null) return null;
        List<EvolutionStage> stages = evolutionStageMapper.selectList(
                Wrappers.<EvolutionStage>lambdaQuery()
                        .eq(EvolutionStage::getChainId, chain.getId())
                        .orderByAsc(EvolutionStage::getStageNo));
        // 反查各 stage pet 的 slug（petId 可空）
        List<Long> petIds = stages.stream().map(EvolutionStage::getPetId).filter(Objects::nonNull).toList();
        Map<Long, Pet> petById = petIds.isEmpty() ? Map.of()
                : listByIds(petIds).stream().collect(Collectors.toMap(Pet::getId, p -> p));

        EvolutionChainDto dto = new EvolutionChainDto();
        dto.setGroupId(groupId);
        dto.setName(chain.getName());
        dto.setStages(stages.stream().map(st -> {
            EvolutionChainDto.EvolutionStageDto s = new EvolutionChainDto.EvolutionStageDto();
            s.setStageNo(st.getStageNo());
            s.setLevel(st.getLevel());
            s.setPetName(st.getPetName());
            Pet p = st.getPetId() != null ? petById.get(st.getPetId()) : null;
            if (p != null) {
                s.setPetSlug(p.getSlug());
                s.setIllustrationKey(p.getIllustrationKey());
            } else {
                s.setIllustrationKey(st.getIllustrationKey());
            }
            s.setTypes(st.getTypes());
            return s;
        }).toList());
        return dto;
    }

    private static PetListItemDto toListItem(Pet p) {
        PetListItemDto d = new PetListItemDto();
        d.setSlug(p.getSlug());
        d.setDexNo(p.getDexNo());
        d.setName(p.getName());
        d.setTitle(p.getTitle());
        d.setStage(p.getStage());
        d.setIllustrationKey(p.getIllustrationKey());
        d.setHeadKey(p.getHeadKey());
        return d;
    }
}
