package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.PetDetailDto;
import com.spiritdex.api.dto.PetListItemDto;
import com.spiritdex.api.service.PetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "精灵图鉴")
@RestController
@RequestMapping("/api/pets")
@RequiredArgsConstructor
public class PetController {

    private final PetService petService;

    @Operation(summary = "精灵列表（分页+筛选）")
    @GetMapping
    public Result<PageResult<PetListItemDto>> list(
            @Parameter(description = "属性 slug，如 grass / fire") @RequestParam(required = false) String type,
            @Parameter(description = "进化阶段 1/2/3") @RequestParam(required = false) Integer stage,
            @Parameter(description = "名字模糊搜索") @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(petService.search(type, stage, q, page, size));
    }

    @Operation(summary = "精灵详情（聚合属性/技能/进化链）")
    @GetMapping("/{slug}")
    public Result<PetDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(petService.getDetail(slug));
    }
}
