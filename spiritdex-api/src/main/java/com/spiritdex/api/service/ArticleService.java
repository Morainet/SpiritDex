package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.common.exception.BizException;
import com.spiritdex.api.dto.ArticleDetailDto;
import com.spiritdex.api.dto.ArticleListItemDto;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.entity.Article;
import com.spiritdex.api.mapper.ArticleMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ArticleService extends ServiceImpl<ArticleMapper, Article> {

    /** 已发布文章分页（可按 category 筛选）。 */
    public PageResult<ArticleListItemDto> search(String category, int page, int size) {
        LambdaQueryWrapper<Article> w = Wrappers.<Article>lambdaQuery()
                .eq(Article::getStatus, "published")
                .orderByDesc(Article::getCreatedAt);
        if (category != null && !category.isBlank()) {
            w.eq(Article::getCategory, category);
        }
        IPage<Article> p = page(new Page<>(page, size), w);
        List<ArticleListItemDto> list = p.getRecords().stream().map(ArticleService::toListItem).toList();
        return PageResult.of(list, p.getTotal(), page, size);
    }

    /** 文章详情（Markdown 正文）。 */
    public ArticleDetailDto getDetail(String slug) {
        Article a = getOne(new LambdaQueryWrapper<Article>().eq(Article::getSlug, slug));
        if (a == null) {
            throw new BizException(4040, "文章不存在: " + slug);
        }
        ArticleDetailDto d = new ArticleDetailDto();
        d.setSlug(a.getSlug());
        d.setTitle(a.getTitle());
        d.setSummary(a.getSummary());
        d.setContent(a.getContent());
        d.setCategory(a.getCategory());
        d.setCoverImage(a.getCoverImage());
        d.setTags(a.getTags());
        d.setAuthorName(a.getAuthorName());
        d.setViewCount(a.getViewCount());
        d.setCreatedAt(a.getCreatedAt());
        d.setUpdatedAt(a.getUpdatedAt());
        return d;
    }

    private static ArticleListItemDto toListItem(Article a) {
        ArticleListItemDto d = new ArticleListItemDto();
        d.setSlug(a.getSlug());
        d.setTitle(a.getTitle());
        d.setSummary(a.getSummary());
        d.setCategory(a.getCategory());
        d.setCoverImage(a.getCoverImage());
        d.setTags(a.getTags());
        d.setAuthorName(a.getAuthorName());
        d.setCreatedAt(a.getCreatedAt());
        return d;
    }
}
