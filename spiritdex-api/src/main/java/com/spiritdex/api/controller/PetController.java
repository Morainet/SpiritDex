package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.PetDetailDto;
import com.spiritdex.api.dto.PetListItemDto;
import com.spiritdex.api.dto.PetStatsDto;
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

import java.util.List;
import java.util.Map;

@Tag(name = "精灵图鉴")
@RestController
@RequestMapping("/api/pets")
@RequiredArgsConstructor
public class PetController {

    private final PetService petService;

    @Operation(summary = "精灵列表（分页+筛选：属性/阶段/分布地区/搜索）")
    @GetMapping
    public Result<PageResult<PetListItemDto>> list(
            @Parameter(description = "属性 slug，如 grass / fire") @RequestParam(required = false) String type,
            @Parameter(description = "进化阶段 1/2/3") @RequestParam(required = false) Integer stage,
            @Parameter(description = "分布地区，如 岚语峰") @RequestParam(required = false) String location,
            @Parameter(description = "名字模糊搜索") @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return Result.success(petService.search(type, stage, q, location, page, size));
    }

    @Operation(summary = "精灵详情（聚合属性/技能/分布地区/进化链）")
    @GetMapping("/{slug}")
    public Result<PetDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(petService.getDetail(slug));
    }

    @Operation(summary = "分布地区聚合（每个地名有多少精灵）")
    @GetMapping("/locations")
    public Result<List<Map<String, Object>>> locations() {
        return Result.success(petService.locationAggregate());
    }

    @Operation(summary = "全量精灵精简数据（种族值+属性，供工具页一次性加载）")
    @GetMapping("/stats")
    public Result<List<PetStatsDto>> stats() {
        return Result.success(petService.allStats());
    }
}

