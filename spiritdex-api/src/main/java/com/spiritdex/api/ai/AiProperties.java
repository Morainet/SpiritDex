package com.spiritdex.api.ai;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

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

    /** 定时 AI 活动攻略生成配置（spiritdex.ai.article-generation.*）。 */
    private ArticleGeneration articleGeneration = new ArticleGeneration();

    /**
     * 定时活动攻略生成配置。
     * 默认关闭——开发环境意外跑会烧 GLM token；生产用环境变量显式开启：
     * SPIRITDEX_AI_ARTICLEGENERATION_ENABLED=true
     */
    @Data
    public static class ArticleGeneration {
        /** 总开关（与 AiProperties.enabled 叠加：两者皆真才执行）。 */
        private boolean enabled = false;
        /** 生成任务 cron（默认每周一 08:00）。 */
        private String generateCron = "0 0 8 ? * MON";
        /** 草稿转发布 cron（默认每周二 08:00）。 */
        private String publishCron = "0 0 8 ? * TUE";
        /** 草稿多少小时后可自动转发布。 */
        private int draftAgeHours = 24;
        /** 单次生成任务最多产出文章数（控成本）。 */
        private int maxArticlesPerRun = 3;
        /** 打手分析：每个活动 boss 返回的推荐打手数量。 */
        private int counterTopN = 10;
        /** 每周培养榜：返回的 Top 精灵数量。 */
        private int weeklyTopN = 10;
        /** 活动数据文件路径（相对工作目录），来自 scraper 产物。 */
        private String activitiesFile = "../data/seed/activities.json";
        /** 文章默认作者名。 */
        private String authorName = "灵宠档案 AI 助手";
        /** 当 activities.json 缺失时，备用的固定话题（保证生成任务有素材）。 */
        private List<String> fallbackTopics = List.of(
                "本周精灵培养优先级推荐",
                "新手常见阵容搭配思路",
                "属性相克实战要点回顾"
        );
    }

    @PostConstruct
    void init() {
        // 有真实 key（非空、非占位 dummy）才启用
        boolean valid = apiKey != null && !apiKey.isBlank() && !"dummy".equalsIgnoreCase(apiKey.trim());
        this.enabled = valid;
        log.info("[ai] GLM AI {}", valid ? "已启用" : "未启用（无有效 GLM_API_KEY）");
    }
}
