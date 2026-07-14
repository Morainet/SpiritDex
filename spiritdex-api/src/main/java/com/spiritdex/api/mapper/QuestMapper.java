package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.Quest;
import org.apache.ibatis.annotations.Mapper;

/** 任务 Mapper（纯展示，无自定义 SQL）。 */
@Mapper
public interface QuestMapper extends BaseMapper<Quest> {
}
