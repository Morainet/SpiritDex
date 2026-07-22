package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体（Phase 7 账号体系）。表名 app_user（避开 PG 保留字 user）。
 * role: USER（普通用户）/ ADMIN（管理员，可访问 /api/admin/**）。
 */
@Data
@TableName("app_user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 登录用户名（唯一）。 */
    private String username;
    /** BCrypt 哈希密码，不序列化到 JSON。 */
    @JsonIgnore
    private String password;
    /** 显示昵称。 */
    private String displayName;
    /** 角色：USER / ADMIN。 */
    private String role;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
