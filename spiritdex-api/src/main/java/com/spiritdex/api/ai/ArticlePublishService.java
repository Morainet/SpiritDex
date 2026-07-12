package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.ai.AiProperties.ArticleGeneration;
import com.spiritdex.api.entity.Article;
import com.spiritdex.api.mapper.ArticleMapper;
import com.spiritdex.api.mapper.EmbeddingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 草稿转发布：把到期（创建超过 draftAgeHours）的 AI 活动攻略草稿转为 published，
 * 并同步建立 embedding 索引（让 RAG 问答能召回文章）。
 *
 * <p>两阶段发布（先 draft 缓冲 → 再 published）的设计目的：给人工审核窗口，
 * AI 偶发幻觉可在草稿期被修正/删除，不直接暴露给用户。
 *
 * <p>embedding 在发布时建而非生成时建：draft 不进检索库，避免半成品污染 RAG。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ArticlePublishService {

    private final ArticleMapper articleMapper;
    private final EmbeddingMapper embeddingMapper;
    private final EmbeddingService embeddingService;
    private final AiProperties aiProps;

    /** 发布结果。 */
    public record PublishResult(int dueCount, int published, int embedded) {
    }

    /**
     * 查找到期草稿并发布。
     *
     * @return 发布结果汇总
     */
    public PublishResult publishDueDrafts() {
        ArticleGeneration cfg = aiProps.getArticleGeneration();
        LocalDateTime cutoff = LocalDateTime.now().minusHours(cfg.getDraftAgeHours());

        List<Article> due = articleMapper.selectList(Wrappers.<Article>lambdaQuery()
                .eq(Article::getAiGenerated, true)
                .eq(Article::getStatus, "draft")
                .lt(Article::getCreatedAt, cutoff));

        if (due.isEmpty()) {
            log.info("[article-publish] 无到期草稿");
            return new PublishResult(0, 0, 0);
        }

        int published = 0, embedded = 0;
        for (Article a : due) {
            try {
                a.setStatus("published");
                articleMapper.updateById(a);
                published++;
                log.info("[article-publish] 发布: slug={} title={}", a.getSlug(), a.getTitle());

                if (buildEmbedding(a)) embedded++;
            } catch (Exception e) {
                log.error("[article-publish] 发布失败 slug={}: {}", a.getSlug(), e.getMessage());
            }
        }
        log.info("[article-publish] 完成：到期 {} 篇，发布 {} 篇，建索引 {} 篇", due.size(), published, embedded);
        return new PublishResult(due.size(), published, embedded);
    }

    /**
     * 为单篇已发布文章建 embedding 索引（article 实体类型）。
     * 幂等：已存在则更新。
     */
    private boolean buildEmbedding(Article a) {
        try {
            String chunk = a.getTitle() + "。" + (a.getSummary() == null ? "" : a.getSummary());
            float[] vec = embeddingService.embed(chunk);
            String literal = EmbeddingService.toVectorLiteral(vec);
            String model = "bge-small-zh";
            if (embeddingMapper.countByEntity("article", a.getId()) > 0) {
                embeddingMapper.updateVector("article", a.getId(), chunk, literal, model);
            } else {
                embeddingMapper.insertVector("article", a.getId(), a.getSlug(), chunk, literal, model);
            }
            return true;
        } catch (Exception e) {
            // embedding 服务不可用不应阻塞发布流程（本地服务可能未起）
            log.warn("[article-publish] embedding 建立失败 slug={}（发布仍生效）: {}", a.getSlug(), e.getMessage());
            return false;
        }
    }
}
