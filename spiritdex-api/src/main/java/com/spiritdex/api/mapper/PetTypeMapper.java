package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.PetType;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PetTypeMapper extends BaseMapper<PetType> {

    /** 物理删除（绕过逻辑删除），用于 SeedRunner 幂等重建关联。 */
    @Delete("DELETE FROM pet_type WHERE pet_id = #{petId}")
    int physicalDeleteByPet(@Param("petId") Long petId);
}
