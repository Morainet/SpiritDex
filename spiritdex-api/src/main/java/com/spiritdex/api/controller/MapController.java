package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.entity.MapPoint;
import com.spiritdex.api.service.MapPointService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "地图")
@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class MapController {

    private final MapPointService mapPointService;

    @Operation(summary = "地图点位列表（可按类型筛选，默认返回全部）")
    @GetMapping("/points")
    public Result<PageResult<MapPoint>> points(
            @RequestParam(required = false) Integer type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "5000") int size
    ) {
        return Result.success(mapPointService.search(type, page, size));
    }

    @Operation(summary = "点位类型聚合统计")
    @GetMapping("/types")
    public Result<List<Map<String, Object>>> types() {
        return Result.success(mapPointService.typeAggregate());
    }
}
