package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.ItemDetailDto;
import com.spiritdex.api.dto.ItemListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.entity.Item;
import com.spiritdex.api.mapper.ItemMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 道具图鉴 Service（纯展示，不注入额外 Mapper）。
 * 仿 SkillService 精简版：无关联反查，search/getDetail 两个方法。
 */
@Service
public class ItemService extends ServiceImpl<ItemMapper, Item> {

    public PageResult<ItemListItemDto> search(String mainCategory, String rarity, String q, int page, int size) {
        page = PageResult.normalizePage(page);
        size = PageResult.normalizeSize(size, 100);
        LambdaQueryWrapper<Item> w = Wrappers.<Item>lambdaQuery().orderByAsc(Item::getId);
        if (mainCategory != null && !mainCategory.isBlank()) w.eq(Item::getMainCategory, mainCategory);
        if (rarity != null && !rarity.isBlank())             w.eq(Item::getRarity, rarity);
        if (q != null && !q.isBlank())                       w.like(Item::getName, q.trim());
        IPage<Item> p = page(new Page<>(page, size), w);
        List<ItemListItemDto> list = p.getRecords().stream().map(ItemService::toListItem).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    public ItemDetailDto getDetail(String slug) {
        Item item = getOne(new LambdaQueryWrapper<Item>().eq(Item::getSlug, slug));
        if (item == null) throw new BizException(4040, "道具不存在: " + slug);
        ItemDetailDto d = new ItemDetailDto();
        d.setSlug(item.getSlug());
        d.setCatalogId(item.getCatalogId());
        d.setName(item.getName());
        d.setRarity(item.getRarity());
        d.setMainCategory(item.getMainCategory());
        d.setSubCategory(item.getSubCategory());
        d.setUsageText(item.getUsageText());
        d.setDescription(item.getDescription());
        d.setSourceText(item.getSourceText());
        d.setIconId(item.getIconId());
        d.setDataVersion(item.getDataVersion());
        d.setSourceUrl(item.getSourceUrl());
        return d;
    }

    private static ItemListItemDto toListItem(Item it) {
        ItemListItemDto d = new ItemListItemDto();
        d.setSlug(it.getSlug());
        d.setName(it.getName());
        d.setRarity(it.getRarity());
        d.setMainCategory(it.getMainCategory());
        d.setSubCategory(it.getSubCategory());
        d.setIconId(it.getIconId());
        return d;
    }
}
