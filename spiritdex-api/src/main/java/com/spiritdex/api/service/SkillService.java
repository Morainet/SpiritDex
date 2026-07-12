package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.SkillDetailDto;
import com.spiritdex.api.dto.SkillListItemDto;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.entity.PetSkill;
import com.spiritdex.api.entity.Skill;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetSkillMapper;
import com.spiritdex.api.mapper.SkillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SkillService extends ServiceImpl<SkillMapper, Skill> {

    private final PetSkillMapper petSkillMapper;
    private final PetMapper petMapper;

    /**
     * 分页筛选：element(属性名) / category(类别) / q(名字模糊) → PageResult。
     */
    public PageResult<SkillListItemDto> search(String element, String category, String q, int page, int size) {
        LambdaQueryWrapper<Skill> w = Wrappers.<Skill>lambdaQuery().orderByAsc(Skill::getCatalogNum);
        if (element != null && !element.isBlank()) {
            w.eq(Skill::getElement, element);
        }
        if (category != null && !category.isBlank()) {
            w.eq(Skill::getCategory, category);
        }
        if (q != null && !q.isBlank()) {
            w.like(Skill::getName, q.trim());
        }
        IPage<Skill> p = page(new Page<>(page, size), w);
        List<SkillListItemDto> list = p.getRecords().stream().map(SkillService::toListItem).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    /**
     * 技能详情 + 反查「哪些精灵以此为特性技能」。
     * 注：pet_skill 当前仅 feature_skill，完整技能池待后续抓取。
     */
    public SkillDetailDto getDetail(String slug) {
        Skill skill = getOne(new LambdaQueryWrapper<Skill>().eq(Skill::getSlug, slug));
        if (skill == null) {
            throw new BizException(4040, "技能不存在: " + slug);
        }
        SkillDetailDto d = new SkillDetailDto();
        d.setSlug(skill.getSlug());
        d.setCatalogId(skill.getCatalogId());
        d.setName(skill.getName());
        d.setCategory(skill.getCategory());
        d.setElement(skill.getElement());
        d.setPower(skill.getPower());
        d.setDamageClass(skill.getDamageClass());
        d.setEnergy(skill.getEnergy());
        d.setTarget(skill.getTarget());
        d.setEffectText(skill.getEffectText());
        d.setFlavorText(skill.getFlavorText());
        d.setIconId(skill.getIconId());

        // 反查以此为特性技能的精灵
        List<PetSkill> rels = petSkillMapper.selectList(
                Wrappers.<PetSkill>lambdaQuery().eq(PetSkill::getSkillId, skill.getId()));
        if (!rels.isEmpty()) {
            List<Long> petIds = rels.stream().map(PetSkill::getPetId).toList();
            Map<Long, Pet> petById = petMapper.selectBatchIds(petIds).stream()
                    .collect(Collectors.toMap(Pet::getId, p -> p));
            d.setPets(rels.stream()
                    .map(r -> petById.get(r.getPetId()))
                    .filter(Objects::nonNull)
                    .map(p -> {
                        SkillDetailDto.LearnerPet lp = new SkillDetailDto.LearnerPet();
                        lp.setSlug(p.getSlug());
                        lp.setName(p.getName());
                        return lp;
                    }).toList());
        } else {
            d.setPets(List.of());
        }
        return d;
    }

    private static SkillListItemDto toListItem(Skill s) {
        SkillListItemDto d = new SkillListItemDto();
        d.setSlug(s.getSlug());
        d.setName(s.getName());
        d.setCategory(s.getCategory());
        d.setElement(s.getElement());
        d.setPower(s.getPower());
        d.setDamageClass(s.getDamageClass());
        d.setEnergy(s.getEnergy());
        d.setIconId(s.getIconId());
        return d;
    }
}
