package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.PetLocation;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface PetLocationMapper extends BaseMapper<PetLocation> {

    /** 物理删除（绕过逻辑删除），用于 SeedRunner 幂等重建关联。 */
    @Delete("DELETE FROM pet_location WHERE pet_id = #{petId}")
    int physicalDeleteByPet(@Param("petId") Long petId);

    /** 地名聚合：每个地名对应多少只精灵（用于地名列表页）。 */
    @Select("SELECT location, COUNT(*) AS cnt FROM pet_location WHERE deleted = 0 GROUP BY location ORDER BY cnt DESC")
    List<Map<String, Object>> locationCounts();

    /** 所有不重复的地名。 */
    @Select("SELECT DISTINCT location FROM pet_location WHERE deleted = 0 ORDER BY location")
    List<String> distinctLocations();
}
