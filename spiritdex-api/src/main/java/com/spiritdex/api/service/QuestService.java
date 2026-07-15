package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.QuestDetailDto;
import com.spiritdex.api.dto.QuestListItemDto;
import com.spiritdex.api.entity.Quest;
import com.spiritdex.api.mapper.QuestMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 任务图鉴 Service（纯展示）。仿 ItemService，search/getDetail 两个方法。
 */
@Service
public class QuestService extends ServiceImpl<QuestMapper, Quest> {

    public PageResult<QuestListItemDto> search(String category, String q, int page, int size) {
        page = PageResult.normalizePage(page);
        size = PageResult.normalizeSize(size, 100);
        LambdaQueryWrapper<Quest> w = Wrappers.<Quest>lambdaQuery().orderByAsc(Quest::getSeq);
        if (category != null && !category.isBlank()) w.eq(Quest::getCategory, category);
        if (q != null && !q.isBlank())               w.like(Quest::getName, q.trim());
        IPage<Quest> p = page(new Page<>(page, size), w);
        List<QuestListItemDto> list = p.getRecords().stream().map(QuestService::toListItem).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    public QuestDetailDto getDetail(String slug) {
        Quest q = getOne(new LambdaQueryWrapper<Quest>().eq(Quest::getSlug, slug));
        if (q == null) throw new BizException(4040, "任务不存在: " + slug);
        QuestDetailDto d = new QuestDetailDto();
        d.setSlug(q.getSlug());
        d.setCatalogId(q.getCatalogId());
        d.setName(q.getName());
        d.setSeq(q.getSeq());
        d.setCategory(q.getCategory());
        d.setLocation(q.getLocation());
        d.setDescription(q.getDescription());
        d.setReward(q.getReward());
        d.setImageKey(q.getImageKey());
        d.setNote(q.getNote());
        d.setAttribution(q.getAttribution());
        d.setSourceUrl(q.getSourceUrl());
        return d;
    }

    private static QuestListItemDto toListItem(Quest q) {
        QuestListItemDto d = new QuestListItemDto();
        d.setSlug(q.getSlug());
        d.setName(q.getName());
        d.setCategory(q.getCategory());
        d.setSeq(q.getSeq());
        d.setLocation(q.getLocation());
        d.setImageKey(q.getImageKey());
        return d;
    }
}
