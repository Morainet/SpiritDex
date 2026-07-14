package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.Item;
import org.apache.ibatis.annotations.Mapper;

/**
 * 道具 Mapper（纯展示，无自定义 SQL）。查询全靠 Service 层 LambdaQueryWrapper。
 */
@Mapper
public interface ItemMapper extends BaseMapper<Item> {
}
