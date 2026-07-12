package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.SkillDetailDto;
import com.spiritdex.api.dto.SkillListItemDto;
import com.spiritdex.api.service.SkillService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "技能库")
@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillService skillService;

    @Operation(summary = "技能列表（分页+筛选）")
    @GetMapping
    public Result<PageResult<SkillListItemDto>> list(
            @RequestParam(required = false) String element,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(skillService.search(element, category, q, page, size));
    }

    @Operation(summary = "技能详情（含可学精灵）")
    @GetMapping("/{slug}")
    public Result<SkillDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(skillService.getDetail(slug));
    }
}
