package com.spiritdex.api.schedule;

import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.ArticleGenerationService;
import com.spiritdex.api.ai.ArticlePublishService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.config.TriggerTask;
import org.springframework.scheduling.support.CronTrigger;

/**
 * 活动攻略定时任务（项目首次引入调度）。
 *
 * <p>用 {@link SchedulingConfigurer} 编程式注册而非 {@code @Scheduled} 注解：
 * 这样能直接读 {@link AiProperties} 的 cron 配置对象，并在 enabled=false 时整体不注册任务，
 * 避免 {@code @Scheduled(cron="${...}")} 占位符缺失导致启动失败。
 *
 * <p>启用条件（两者皆真才注册任务）：
 * <ul>
 *   <li>{@code spiritdex.ai.article-generation.enabled=true}（默认 false，生产显式开）</li>
 *   <li>有效的 {@code GLM_API_KEY}（由 {@link AiProperties#isEnabled()} 推导）</li>
 * </ul>
 *
 * <p>关键决策：用 {@link ConditionalOnProperty} 而非 {@code @Profile} —— 生产 Docker
 * 跑默认 profile，用 @Profile 会导致定时任务在生产不生效（项目现有 CommandLineRunner 的痛点）。
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spiritdex.ai.article-generation.enabled", havingValue = "true")
public class ArticleScheduleConfig implements SchedulingConfigurer {

    private final AiProperties aiProps;
    private final ArticleGenerationService generationService;
    private final ArticlePublishService publishService;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        if (!aiProps.isEnabled()) {
            log.warn("[schedule] GLM AI 未启用，即使 article-generation.enabled=true 也不注册定时任务");
            return;
        }
        AiProperties.ArticleGeneration cfg = aiProps.getArticleGeneration();

        // 任务 1：生成最新活动攻略（默认每周一 08:00）
        registrar.addTriggerTask(new TriggerTask(
                () -> safeRun("generate", generationService::generateLatest),
                new CronTrigger(cfg.getGenerateCron())
        ));

        // 任务 2：草稿转发布（默认每周二 08:00）
        registrar.addTriggerTask(new TriggerTask(
                () -> safeRun("publish", publishService::publishDueDrafts),
                new CronTrigger(cfg.getPublishCron())
        ));

        log.info("[schedule] 活动攻略定时任务已注册：生成 cron={}, 发布 cron={}",
                cfg.getGenerateCron(), cfg.getPublishCron());
    }

    /** 任务执行包装：捕获异常避免调度线程因单次失败而静默退出。 */
    private void safeRun(String name, Runnable task) {
        try {
            log.info("[schedule] 开始执行任务: {}", name);
            task.run();
        } catch (Exception e) {
            log.error("[schedule] 任务 {} 执行失败: {}", name, e.getMessage(), e);
        }
    }
}
