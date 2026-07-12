package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.EvolutionStage;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface EvolutionStageMapper extends BaseMapper<EvolutionStage> {

    /** 物理删除某链下全部阶段（绕过逻辑删除），用于 SeedRunner 幂等重建。 */
    @Delete("DELETE FROM evolution_stage WHERE chain_id = #{chainId}")
    int physicalDeleteByChain(@Param("chainId") Long chainId);

    /** 物理删除单个阶段（绕过逻辑删除），避免唯一约束冲突。 */
    @Delete("DELETE FROM evolution_stage WHERE chain_id = #{chainId} AND stage_no = #{stageNo}")
    int physicalDelete(@Param("chainId") Long chainId, @Param("stageNo") Integer stageNo);
}
