package com.spiritdex.api.config;

import com.spiritdex.api.security.JwtAccessDeniedHandler;
import com.spiritdex.api.security.JwtAuthEntryPoint;
import com.spiritdex.api.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationRegistry;

import java.util.List;

/**
 * Spring Security 6 配置（Phase 7）。
 *
 * <p>策略：
 * <ul>
 *   <li>纯 JWT，无 session（STATELESS），CSRF 关闭</li>
 *   <li>公开读端点（/api/pets/** 等）+ 认证端点（/api/auth/**）+ swagger → permitAll</li>
 *   <li>/api/admin/** → hasRole(ADMIN)</li>
 *   <li>其余请求默认 permitAll（AI 端点靠内部限流，不强制登录）</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthEntryPoint jwtAuthEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Value("${spiritdex.cors.origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String[] allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 公开读端点
                .requestMatchers(
                    "/api/pets/**", "/api/skills/**", "/api/items/**",
                    "/api/quests/**", "/api/marks/**", "/api/types/**",
                    "/api/map/**", "/api/articles/**", "/api/image-proxy",
                    "/api/ai/**"
                ).permitAll()
                // 认证端点
                .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                // Swagger
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // 管理端点（需 ADMIN）
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 其余默认放行
                .anyRequest().permitAll()
            )
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint(jwtAuthEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler)
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationRegistry registry = new UrlBasedCorsConfigurationRegistry();
        registry.registerCorsConfiguration("/api/**", config);
        return registry;
    }
}
