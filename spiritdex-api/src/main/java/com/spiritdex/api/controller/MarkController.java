package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.MarkDetailDto;
import com.spiritdex.api.dto.MarkListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.service.MarkService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "印记图鉴")
@RestController
@RequestMapping("/api/marks")
@RequiredArgsConstructor
public class MarkController {

    private final MarkService markService;

    @Operation(summary = "印记列表（分页+筛选：阵营/搜索）")
    @GetMapping
    public Result<PageResult<MarkListItemDto>> list(
            @RequestParam(required = false) String faction,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(markService.search(faction, q, page, size));
    }

    @Operation(summary = "印记详情（含机制说明/可施加技能）")
    @GetMapping("/{slug}")
    public Result<MarkDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(markService.getDetail(slug));
    }
}
