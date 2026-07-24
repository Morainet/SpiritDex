package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.PetListItemDto;
import com.spiritdex.api.service.FavoriteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 收藏端点（Phase 7 第二期）。所有端点需要登录。
 *
 * <p>SecurityConfig 中 /api/favorites/** 未显式配置，但默认 anyRequest().permitAll()。
 * 这里在方法内校验 authentication，未登录返回 401（由 GlobalExceptionHandler 或手动）。
 */
@Tag(name = "收藏")
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;

    /** 当前用户的所有收藏（已登录）。 */
    @Operation(summary = "我的收藏列表")
    @GetMapping
    public Result<PageResult<PetListItemDto>> myFavorites(
            Authentication auth,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        Long userId = requireLogin(auth);
        return Result.success(favoriteService.listUserFavorites(userId, page, size));
    }

    /** 检查是否已收藏某精灵。 */
    @Operation(summary = "检查是否已收藏")
    @GetMapping("/check/{slug}")
    public Result<Map<String, Boolean>> check(Authentication auth, @PathVariable String slug) {
        if (auth == null || auth.getPrincipal() == null) {
            return Result.success(Map.of("favorited", false));
        }
        Long userId = (Long) auth.getPrincipal();
        return Result.success(Map.of("favorited", favoriteService.isFavorited(userId, slug)));
    }

    /** 收藏精灵。 */
    @Operation(summary = "收藏精灵")
    @PostMapping("/{slug}")
    public Result<Void> add(Authentication auth, @PathVariable String slug) {
        Long userId = requireLogin(auth);
        favoriteService.addFavorite(userId, slug);
        return Result.success(null);
    }

    /** 取消收藏。 */
    @Operation(summary = "取消收藏")
    @DeleteMapping("/{slug}")
    public Result<Void> remove(Authentication auth, @PathVariable String slug) {
        Long userId = requireLogin(auth);
        favoriteService.removeFavorite(userId, slug);
        return Result.success(null);
    }

    private Long requireLogin(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new com.spiritdex.api.common.exception.BizException(401, "请先登录");
        }
        return (Long) auth.getPrincipal();
    }
}
