package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.ArticleDetailDto;
import com.spiritdex.api.dto.ArticleListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "攻略文章")
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;

    @Operation(summary = "文章列表（分页，仅 published）")
    @GetMapping
    public Result<PageResult<ArticleListItemDto>> list(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return Result.success(articleService.search(category, page, size));
    }

    @Operation(summary = "文章详情（Markdown 正文）")
    @GetMapping("/{slug}")
    public Result<ArticleDetailDto> getBySlug(@PathVariable String slug) {
        return Result.success(articleService.getDetail(slug));
    }
}
