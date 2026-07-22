package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    /** 按用户名查（含逻辑删行，登录需要查到真实密码校验）。 */
    @Select("SELECT * FROM app_user WHERE username = #{username} LIMIT 1")
    User findByUsername(@Param("username") String username);
}
