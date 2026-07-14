package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.ItemDetailDto;
import com.spiritdex.api.dto.ItemListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.service.ItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "道具图鉴")
@RestController
@RequestMapping("/api/items")
@RequiredArgsConstructor
public class ItemController {

    private final ItemService itemService;

    @Operation(summary = "道具列表（分页+筛选：主分类/稀有度/搜索）")
    @GetMapping
    public Result<PageResult<ItemListItemDto>> list(
            @RequestParam(required = false) String mainCategory,
            @RequestParam(required = false) String rarity,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(itemService.search(mainCategory, rarity, q, page, size));
    }

    @Operation(summary = "道具详情")
    @GetMapping("/{slug}")
    public Result<ItemDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(itemService.getDetail(slug));
    }
}
