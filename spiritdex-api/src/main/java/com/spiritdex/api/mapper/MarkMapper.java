package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.Mark;
import org.apache.ibatis.annotations.Mapper;

/** 印记 Mapper（纯展示，无自定义 SQL）。 */
@Mapper
public interface MarkMapper extends BaseMapper<Mark> {
}
