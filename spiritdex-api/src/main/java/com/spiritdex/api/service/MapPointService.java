package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.entity.MapPoint;
import com.spiritdex.api.mapper.MapPointMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 地图点位 Service（纯展示）。支持按类型筛选 + 类型聚合统计。
 */
@Service
public class MapPointService extends ServiceImpl<MapPointMapper, MapPoint> {

    /** 分页查点位（可按 markType 筛选，size 默认放大到 5000 便于前端一次性渲染）。 */
    public PageResult<MapPoint> search(Integer markType, int page, int size) {
        page = PageResult.normalizePage(page);
        size = PageResult.normalizeSize(size, 5000); // 地图点位需全量返回，放宽上限
        LambdaQueryWrapper<MapPoint> w = Wrappers.<MapPoint>lambdaQuery().orderByAsc(MapPoint::getMarkType);
        if (markType != null) {
            w.eq(MapPoint::getMarkType, markType);
        }
        IPage<MapPoint> p = page(new Page<>(page, size), w);
        return PageResult.of(p.getRecords(), p.getTotal(), page, size);
    }

    /** 各点位类型统计：[{markType, typeName, count}, ...]。 */
    public List<Map<String, Object>> typeAggregate() {
        List<MapPoint> all = list();
        return all.stream()
                .collect(Collectors.groupingBy(MapPoint::getMarkType))
                .entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("markType", e.getKey());
                    m.put("typeName", e.getValue().get(0).getTypeName());
                    m.put("count", e.getValue().size());
                    return m;
                })
                .sorted((a, b) -> (int) a.get("markType") - (int) b.get("markType"))
                .toList();
    }
}
