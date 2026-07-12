package com.spiritdex.api.seed;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * seed 相关配置（application.yml 的 spiritdex.seed.*）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "spiritdex.seed")
public class SeedProperties {

    /**
     * seed JSON 目录。默认相对 spiritdex-api 工作目录的 ../data/seed。
     */
    private String dir = "../data/seed";
}
