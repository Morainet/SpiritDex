package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.Favorite;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FavoriteMapper extends BaseMapper<Favorite> {

    /** 物理删（绕过逻辑删除），用于幂等切换收藏状态。 */
    @org.apache.ibatis.annotations.Delete(
        "DELETE FROM favorite WHERE user_id = #{userId} AND pet_slug = #{petSlug}"
    )
    int physicalDelete(@Param("userId") Long userId, @Param("petSlug") String petSlug);

    /** 统计某用户收藏数（含逻辑删过滤）。 */
    @Select("SELECT COUNT(*) FROM favorite WHERE user_id = #{userId} AND deleted = 0")
    long countByUser(@Param("userId") Long userId);
}
