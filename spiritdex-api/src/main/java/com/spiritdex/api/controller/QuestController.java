package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.QuestDetailDto;
import com.spiritdex.api.dto.QuestListItemDto;
import com.spiritdex.api.service.QuestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "任务图鉴")
@RestController
@RequestMapping("/api/quests")
@RequiredArgsConstructor
public class QuestController {

    private final QuestService questService;

    @Operation(summary = "任务列表（分页+筛选：分类/搜索）")
    @GetMapping
    public Result<PageResult<QuestListItemDto>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(questService.search(category, q, page, size));
    }

    @Operation(summary = "任务详情")
    @GetMapping("/{slug}")
    public Result<QuestDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(questService.getDetail(slug));
    }
}
