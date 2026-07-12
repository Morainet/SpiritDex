package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.mapper.EmbeddingMapper;
import com.spiritdex.api.mapper.PetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * RAG 检索：混合召回（名字精确匹配 + embedding 语义检索），返回带元数据的片段。
 *
 * <p>纯 embedding 对中文短专名（如「水灵」）召回弱，故加名字 LIKE 双路召回：
 * 名字命中的精灵优先（similarity 标 1.0），再补 embedding 语义结果，去重合并。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Retriever {

    private final EmbeddingMapper embeddingMapper;
    private final PetMapper petMapper;
    private final EmbeddingService embeddingService;
    private final AiProperties props;

    public record Snippet(Long petId, String slug, String name, double similarity, String chunkText) {
    }

    /**
     * 混合检索：名字 LIKE 命中（高优先）+ embedding 语义召回，去重合并。
     */
    public List<Snippet> retrieve(String question) {
        // 1. 名字匹配（精确，解决「水灵」「迪莫」等专名召回弱）
        List<Snippet> byName = nameMatch(question);
        // 2. embedding 语义召回
        List<Snippet> byVec = vectorSearch(question);

        // 合并去重（按 petId），名字命中优先（已在前），保持插入顺序
        LinkedHashMap<Long, Snippet> merged = new LinkedHashMap<>();
        for (Snippet s : byName) merged.putIfAbsent(s.petId(), s);
        for (Snippet s : byVec) merged.putIfAbsent(s.petId(), s);
        List<Snippet> out = new ArrayList<>(merged.values());
        if (out.size() > props.getTopK()) out = out.subList(0, props.getTopK());
        log.debug("[rag] 检索: 名字{}条 语义{}条 合并{}条 | Q={}", byName.size(), byVec.size(), out.size(), question);
        return out;
    }

    /**
     * 名字匹配：在问题中找出出现的精灵名（用 2~4 字子串匹配 pet.name）。
     * 命中的精灵 similarity 给高分（1.0），排在语义结果之前。
     */
    private List<Snippet> nameMatch(String question) {
        // 加载全部精灵名（671 条，量小可全扫），找出问题里出现的名字
        List<Pet> all = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getDexNo).orderByAsc(Pet::getDexNo));
        List<Pet> hits = new ArrayList<>();
        for (Pet p : all) {
            if (p.getName() != null && p.getName().length() >= 2 && question.contains(p.getName())) {
                hits.add(p);
            }
        }
        if (hits.isEmpty()) return List.of();
        // 取命中精灵的 chunk（从 embedding 表取；若无则现拼）
        Map<Long, String> chunkById = loadChunks(hits.stream().map(Pet::getId).toList());
        return hits.stream().limit(props.getTopK()).map(p -> new Snippet(
                p.getId(), p.getSlug(), p.getName(), 1.0,
                chunkById.getOrDefault(p.getId(),
                        Prompts.petChunk(p.getName(), "", p.getStage() == null ? "" : p.getStage() + "", p.getDescription()))
        )).toList();
    }

    /** 批量取 chunk_text → petId 映射。 */
    private Map<Long, String> loadChunks(List<Long> petIds) {
        if (petIds.isEmpty()) return Map.of();
        return embeddingMapper.chunksByEntityIds("pet", petIds).stream()
                .collect(Collectors.toMap(
                        r -> ((Number) r.get("entityId")).longValue(),
                        r -> r.get("chunkText") == null ? "" : r.get("chunkText").toString(),
                        (a, b) -> a));
    }

    private List<Snippet> vectorSearch(String question) {
        float[] qvec;
        try {
            qvec = embeddingService.embed(question);
        } catch (Exception e) {
            log.warn("[rag] 问题向量化失败，仅用名字检索: {}", e.getMessage());
            return List.of();
        }
        String literal = EmbeddingService.toVectorLiteral(qvec);
        List<Map<String, Object>> rows = embeddingMapper.searchSimilar("pet", literal, props.getTopK());
        List<Long> petIds = rows.stream().map(r -> ((Number) r.get("entityid")).longValue()).toList();
        Map<Long, Pet> petById = petIds.isEmpty() ? Map.of()
                : petMapper.selectBatchIds(petIds).stream().collect(Collectors.toMap(Pet::getId, p -> p));

        List<Snippet> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Long petId = ((Number) r.get("entityid")).longValue();
            Pet pet = petById.get(petId);
            if (pet == null) continue;
            double sim = ((Number) r.get("similarity")).doubleValue();
            out.add(new Snippet(petId, pet.getSlug(), pet.getName(), sim, (String) r.get("chunktext")));
        }
        return out;
    }
}
