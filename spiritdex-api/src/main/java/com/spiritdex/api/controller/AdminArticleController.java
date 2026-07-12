package com.spiritdex.api.controller;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.ai.ArticleGenerationService;
import com.spiritdex.api.ai.ArticlePublishService;
import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.ArticleListItemDto;
import com.spiritdex.api.entity.Article;
import com.spiritdex.api.mapper.ArticleMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 活动攻略生成管理端点（手动触发/调试用）。
 *
 * <p>⚠️ 安全说明：项目 MVP 阶段无鉴权（Phase 7 才接 Spring Security）。
 * 上线前必须用 Nginx IP 白名单或 basic auth 兜底保护这些写操作端点，
 * 否则任何人都能触发 GLM 调用消耗 token、或修改文章状态。
 */
@Tag(name = "管理-活动攻略生成")
@RestController
@RequestMapping("/api/admin/articles")
@RequiredArgsConstructor
public class AdminArticleController {

    private final ArticleGenerationService generationService;
    private final ArticlePublishService publishService;
    private final ArticleMapper articleMapper;

    @Operation(summary = "手动触发生成最新活动攻略（异步 draft 落库）")
    @PostMapping("/generate")
    public Result<ArticleGenerationService.GenerationResult> generate() {
        return Result.success(generationService.generateLatest());
    }

    @Operation(summary = "手动触发到期草稿转发布（含建 embedding 索引）")
    @PostMapping("/publish-due")
    public Result<ArticlePublishService.PublishResult> publishDue() {
        return Result.success(publishService.publishDueDrafts());
    }

    @Operation(summary = "列出当前 AI 草稿（人工审核用）")
    @GetMapping("/drafts")
    public Result<List<ArticleListItemDto>> drafts() {
        List<Article> list = articleMapper.selectList(Wrappers.<Article>lambdaQuery()
                .eq(Article::getAiGenerated, true)
                .eq(Article::getStatus, "draft")
                .orderByDesc(Article::getCreatedAt));
        List<ArticleListItemDto> dtos = list.stream().map(AdminArticleController::toDto).toList();
        return Result.success(dtos);
    }

    private static ArticleListItemDto toDto(Article a) {
        ArticleListItemDto d = new ArticleListItemDto();
        d.setSlug(a.getSlug());
        d.setTitle(a.getTitle());
        d.setSummary(a.getSummary());
        d.setCategory(a.getCategory());
        d.setCoverImage(a.getCoverImage());
        d.setTags(a.getTags());
        d.setAuthorName(a.getAuthorName());
        d.setCreatedAt(a.getCreatedAt());
        d.setAiGenerated(a.getAiGenerated());
        return d;
    }
}
