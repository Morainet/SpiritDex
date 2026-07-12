package com.spiritdex.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS 配置。允许的源由环境变量 CORS_ORIGINS 配置（逗号分隔），
 * 默认含本地开发地址；生产环境设为前端真实域名。
 *
 * <p>部署时：{@code CORS_ORIGINS=https://lingchong.example.com,https://www.lingchong.example.com}
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${spiritdex.cors.origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
