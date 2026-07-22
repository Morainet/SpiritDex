package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.auth.AuthResponse;
import com.spiritdex.api.dto.auth.LoginRequest;
import com.spiritdex.api.dto.auth.RegisterRequest;
import com.spiritdex.api.entity.User;
import com.spiritdex.api.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 认证端点（Phase 7）。
 * /api/auth/login 和 /api/auth/register 在 SecurityConfig 中 permitAll；
 * /api/auth/me 需要 authenticated（但当前 SecurityConfig 默认 permitAll，靠 Filter 注入的 userId 判断）。
 */
@Tag(name = "认证")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @Operation(summary = "注册（用户名+密码）")
    @PostMapping("/register")
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return Result.success(userService.register(req));
    }

    @Operation(summary = "登录")
    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return Result.success(userService.login(req));
    }

    @Operation(summary = "获取当前登录用户信息")
    @GetMapping("/me")
    public Result<User> me(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return Result.error(401, "未登录");
        }
        Long userId = (Long) authentication.getPrincipal();
        return Result.success(userService.getById(userId));
    }

    @Operation(summary = "登出（前端清 token 即可，后端无状态）")
    @PostMapping("/logout")
    public Result<Void> logout() {
        // JWT 无状态，登出由前端清除 token 实现
        return Result.success(null);
    }
}
