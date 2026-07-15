package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.MarkDetailDto;
import com.spiritdex.api.dto.MarkListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.entity.Mark;
import com.spiritdex.api.mapper.MarkMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 印记图鉴 Service（纯展示）。仿 ItemService/QuestService。
 */
@Service
public class MarkService extends ServiceImpl<MarkMapper, Mark> {

    public PageResult<MarkListItemDto> search(String faction, String q, int page, int size) {
        page = PageResult.normalizePage(page);
        size = PageResult.normalizeSize(size, 100);
        LambdaQueryWrapper<Mark> w = Wrappers.<Mark>lambdaQuery()
                .orderByAsc(Mark::getFaction).orderByAsc(Mark::getName);
        if (faction != null && !faction.isBlank()) w.eq(Mark::getFaction, faction);
        if (q != null && !q.isBlank())             w.like(Mark::getName, q.trim());
        IPage<Mark> p = page(new Page<>(page, size), w);
        List<MarkListItemDto> list = p.getRecords().stream().map(MarkService::toListItem).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    public MarkDetailDto getDetail(String slug) {
        Mark m = getOne(new LambdaQueryWrapper<Mark>().eq(Mark::getSlug, slug));
        if (m == null) throw new BizException(4040, "印记不存在: " + slug);
        MarkDetailDto d = new MarkDetailDto();
        d.setSlug(m.getSlug());
        d.setCatalogId(m.getCatalogId());
        d.setName(m.getName());
        d.setFaction(m.getFaction());
        d.setEffectText(m.getEffectText());
        d.setMechanics(m.getMechanics());
        d.setSourceSkills(m.getSourceSkills());
        d.setSourceUrl(m.getSourceUrl());
        return d;
    }

    private static MarkListItemDto toListItem(Mark m) {
        MarkListItemDto d = new MarkListItemDto();
        d.setSlug(m.getSlug());
        d.setName(m.getName());
        d.setFaction(m.getFaction());
        d.setEffectText(m.getEffectText());
        return d;
    }
}
