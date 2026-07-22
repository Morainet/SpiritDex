package com.spiritdex.api.dto.auth;

import lombok.Data;

/** 登录/注册成功响应（含 JWT token + 用户基本信息）。 */
@Data
public class AuthResponse {
    private String token;
    private Long userId;
    private String username;
    private String displayName;
    private String role;
}
