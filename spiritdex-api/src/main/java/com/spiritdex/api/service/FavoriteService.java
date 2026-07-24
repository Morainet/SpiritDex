package com.spiritdex.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.spiritdex.api.dto.PageResult;
import com.spiritdex.api.dto.PetListItemDto;
import com.spiritdex.api.entity.Favorite;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.mapper.FavoriteMapper;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetTypeMapper;
import com.spiritdex.api.mapper.TypeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 收藏服务：收藏/取消收藏/查列表/查是否收藏。
 * 依赖 PetService 的批量类型加载逻辑（复用 PetTypeMapper + TypeMapper）。
 */
@Service
@RequiredArgsConstructor
public class FavoriteService extends ServiceImpl<FavoriteMapper, Favorite> {

    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final TypeMapper typeMapper;

    /** 收藏（幂等：已收藏则不变）。 */
    public void addFavorite(Long userId, String petSlug) {
        // 物理删旧（含逻辑删行）再插，保证幂等
        baseMapper.physicalDelete(userId, petSlug);
        Favorite f = new Favorite();
        f.setUserId(userId);
        f.setPetSlug(petSlug);
        f.setDeleted(0);
        baseMapper.insert(f);
    }

    /** 取消收藏（幂等）。 */
    public void removeFavorite(Long userId, String petSlug) {
        baseMapper.physicalDelete(userId, petSlug);
    }

    /** 查询是否已收藏。 */
    public boolean isFavorited(Long userId, String petSlug) {
        return baseMapper.selectOne(Wrappers.<Favorite>lambdaQuery()
                .eq(Favorite::getUserId, userId)
                .eq(Favorite::getPetSlug, petSlug)) != null;
    }

    /** 当前用户收藏的精灵列表（分页，返回 PetListItemDto）。 */
    public PageResult<PetListItemDto> listUserFavorites(Long userId, int page, int size) {
        page = PageResult.normalizePage(page);
        size = PageResult.normalizeSize(size, 100);

        LambdaQueryWrapper<Favorite> w = Wrappers.<Favorite>lambdaQuery()
                .eq(Favorite::getUserId, userId)
                .orderByDesc(Favorite::getCreatedAt);
        long total = baseMapper.selectCount(w);

        // 分页查收藏记录 → 拿 pet_slug 列表 → 批量查 Pet
        int offset = (page - 1) * size;
        w.last("LIMIT " + size + " OFFSET " + offset);
        List<Favorite> favs = baseMapper.selectList(w);
        if (favs.isEmpty()) {
            return PageResult.of(List.of(), 0, page, size);
        }
        List<String> slugs = favs.stream().map(Favorite::getPetSlug).toList();
        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery().in(Pet::getSlug, slugs));
        // 保持收藏顺序
        Map<String, Pet> petBySlug = pets.stream().collect(Collectors.toMap(Pet::getSlug, p -> p));
        List<PetListItemDto> list = slugs.stream()
                .map(petBySlug::get)
                .filter(p -> p != null)
                .map(FavoriteService::toListItem)
                .toList();
        // 批量加载属性名
        if (!pets.isEmpty()) {
            Map<Long, List<String>> typesByPetId = loadTypeNames(pets);
            for (int i = 0; i < pets.size(); i++) {
                Pet p = pets.get(i);
                list.stream().filter(d -> d.getSlug().equals(p.getSlug())).findFirst()
                        .ifPresent(d -> d.setTypes(typesByPetId.getOrDefault(p.getId(), List.of())));
            }
        }
        return PageResult.of(list, total, page, size);
    }

    private Map<Long, List<String>> loadTypeNames(List<Pet> pets) {
        List<Long> petIds = pets.stream().map(Pet::getId).toList();
        var rels = petTypeMapper.selectList(
                Wrappers.<com.spiritdex.api.entity.PetType>lambdaQuery()
                        .in(com.spiritdex.api.entity.PetType::getPetId, petIds)
                        .orderByAsc(com.spiritdex.api.entity.PetType::getSlot));
        if (rels.isEmpty()) return Map.of();
        Map<Long, com.spiritdex.api.entity.Type> typeById = typeMapper.selectBatchIds(
                rels.stream().map(com.spiritdex.api.entity.PetType::getTypeId).distinct().toList())
                .stream().collect(Collectors.toMap(com.spiritdex.api.entity.Type::getId, t -> t));
        Map<Long, List<String>> out = new java.util.HashMap<>();
        for (var r : rels) {
            var t = typeById.get(r.getTypeId());
            if (t != null) {
                out.computeIfAbsent(r.getPetId(), k -> new java.util.ArrayList<>()).add(t.getName());
            }
        }
        return out;
    }

    private static PetListItemDto toListItem(Pet p) {
        PetListItemDto d = new PetListItemDto();
        d.setSlug(p.getSlug());
        d.setDexNo(p.getDexNo());
        d.setName(p.getName());
        d.setTitle(p.getTitle());
        d.setStage(p.getStage());
        d.setIllustrationKey(p.getIllustrationKey());
        d.setHeadKey(p.getHeadKey());
        return d;
    }
}
