package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.PetSkill;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PetSkillMapper extends BaseMapper<PetSkill> {

    /** 物理查询（含逻辑删行），用于 SeedRunner 幂等判断。 */
    @Select("SELECT * FROM pet_skill WHERE pet_id = #{petId} AND skill_id = #{skillId} LIMIT 1")
    PetSkill selectPhysical(@Param("petId") Long petId, @Param("skillId") Long skillId);

    /** 物理删除（绕过逻辑删除）。 */
    @Delete("DELETE FROM pet_skill WHERE pet_id = #{petId} AND skill_id = #{skillId}")
    int physicalDelete(@Param("petId") Long petId, @Param("skillId") Long skillId);
}
