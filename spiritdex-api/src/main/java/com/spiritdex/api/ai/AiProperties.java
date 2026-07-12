package com.spiritdex.api.ai;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * AI 配置（spiritdex.ai.*）。
 * enabled 自动由 GLM_API_KEY 是否有效（非空、非 dummy）推导，无需手填。
 */
@Slf4j
@Data
@Component
@ConfigurationProperties(prefix = "spiritdex.ai")
public class AiProperties {

    /** 是否启用 AI（由 key 推导，见 @PostConstruct）。 */
    private boolean enabled = false;

    /** embedding 维度（embedding-3 调用时传 dimensions 参数）。 */
    private int embeddingDim = 1024;

    /** RAG 检索 top-K。 */
    private int topK = 5;

    /** 单次问答限流：每 IP 每小时上限。 */
    private int rateLimitPerHour = 30;

    @Value("${spring.ai.openai.api-key:}")
    private String apiKey;

    /** 本地 embedding 服务地址（sentence-transformers，替代付费的 GLM embedding-3）。 */
    private String localEmbeddingUrl = "http://localhost:8710";

    @PostConstruct
    void init() {
        // 有真实 key（非空、非占位 dummy）才启用
        boolean valid = apiKey != null && !apiKey.isBlank() && !"dummy".equalsIgnoreCase(apiKey.trim());
        this.enabled = valid;
        log.info("[ai] GLM AI {}", valid ? "已启用" : "未启用（无有效 GLM_API_KEY）");
    }
}
