package com.spiritdex.api.service;

import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.auth.AuthResponse;
import com.spiritdex.api.dto.auth.LoginRequest;
import com.spiritdex.api.dto.auth.RegisterRequest;
import com.spiritdex.api.entity.User;
import com.spiritdex.api.mapper.UserMapper;
import com.spiritdex.api.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 用户服务：注册 / 登录 / 获取当前用户。
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    /** 注册：查重 → BCrypt 加密 → 入库 → 发 token。 */
    public AuthResponse register(RegisterRequest req) {
        // 查重
        if (userMapper.findByUsername(req.getUsername()) != null) {
            throw new BizException(4009, "用户名已存在");
        }
        User user = new User();
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setDisplayName(req.getDisplayName() != null && !req.getDisplayName().isBlank()
                ? req.getDisplayName() : req.getUsername());
        user.setRole("USER");
        userMapper.insert(user);

        return buildAuthResponse(user);
    }

    /** 登录：查用户 → 校验密码 → 发 token。 */
    public AuthResponse login(LoginRequest req) {
        User user = userMapper.findByUsername(req.getUsername());
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BizException(4001, "用户名或密码错误");
        }
        return buildAuthResponse(user);
    }

    /** 根据用户 ID 查用户（用于 /api/auth/me）。 */
    public User getById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BizException(4040, "用户不存在");
        }
        return user;
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = tokenProvider.generateToken(user.getId(), user.getUsername(), user.getRole());
        AuthResponse resp = new AuthResponse();
        resp.setToken(token);
        resp.setUserId(user.getId());
        resp.setUsername(user.getUsername());
        resp.setDisplayName(user.getDisplayName());
        resp.setRole(user.getRole());
        return resp;
    }
}
