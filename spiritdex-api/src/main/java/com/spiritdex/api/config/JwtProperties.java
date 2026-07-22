package com.spiritdex.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * JWT 配置（spiritdex.security.*）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "spiritdex.security")
public class JwtProperties {

    /** JWT 签名密钥（至少 32 字符，生产用环境变量覆盖）。 */
    private String jwtSecret = "dev-secret-key-change-in-production-at-least-32-chars-long";

    /** JWT 过期时间（小时），默认 168 = 7 天。 */
    private int jwtExpireHours = 168;
}
