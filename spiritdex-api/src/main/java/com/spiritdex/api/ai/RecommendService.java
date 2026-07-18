package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.entity.PetType;
import com.spiritdex.api.entity.Type;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetTypeMapper;
import com.spiritdex.api.mapper.TypeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 阵容/培养推荐：组装用户已有精灵数据 → GLM 流式推理。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendService {

    private final OpenAiChatModel chatModel;
    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final TypeMapper typeMapper;

    /**
     * 流式推荐。ownedSlugs 为用户已有精灵 slug 列表，goal 为目标场景。
     */
    public Flux<String> recommend(List<String> ownedSlugs, String goal) {
        String petsBlock = buildPetsBlock(ownedSlugs);
        String userContent = String.format(Prompts.RECOMMEND_USER_TEMPLATE,
                goal == null || goal.isBlank() ? "综合对战" : goal, petsBlock);

        Prompt prompt = new Prompt(List.of(
                new SystemMessage(Prompts.RECOMMEND_SYSTEM),
                new UserMessage(userContent)
        ));
        log.debug("[recommend] 已有 {} 只，目标 {}", ownedSlugs.size(), goal);
        return chatModel.stream(prompt)
                .map(resp -> {
                    String t = resp.getResult().getOutput().getText();
                    return t == null ? "" : t;
                })
                .filter(s -> !s.isEmpty());
    }

    /**
     * 结构化阵容推荐（非流式，一次性返回 JSON 卡片数据）。
     * 让 GLM 输出 JSON 数组，解析成 List<RecommendItem>。
     * 比 markdown 流式更适合前端渲染成精灵卡片。
     */
    public java.util.List<RecommendItem> recommendStructured(List<String> ownedSlugs, String goal) {
        String petsBlock = buildPetsBlockWithSlug(ownedSlugs);
        String userContent = String.format(Prompts.RECOMMEND_STRUCTURED_USER,
                goal == null || goal.isBlank() ? "综合对战" : goal, petsBlock);

        Prompt prompt = new Prompt(List.of(
                new SystemMessage(Prompts.RECOMMEND_STRUCTURED_SYSTEM),
                new UserMessage(userContent)
        ));
        log.debug("[recommend-cards] 已有 {} 只，目标 {}", ownedSlugs.size(), goal);
        String raw = chatModel.call(prompt).getResult().getOutput().getText();
        return parseRecommendJson(raw);
    }

    /** 解析 GLM 返回的 JSON 数组，容错处理（去 markdown 围栏、提取首个 [..]）。 */
    private java.util.List<RecommendItem> parseRecommendJson(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        String s = raw.trim();
        // 去掉可能的 ```json ... ``` 围栏
        if (s.startsWith("```")) {
            s = s.replaceAll("^```\\w*\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        // 提取首个 [ 到最后一个 ]（GLM 可能前后带解释）
        int start = s.indexOf('[');
        int end = s.lastIndexOf(']');
        if (start < 0 || end < 0 || end <= start) return List.of();
        String json = s.substring(start, end + 1);
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.List<RecommendItem>>() {});
        } catch (Exception e) {
            log.warn("[recommend-cards] JSON 解析失败: {} | 原文: {}", e.getMessage(), raw);
            return List.of();
        }
    }

    /** 结构化推荐单条（前端渲染成卡片）。 */
    public record RecommendItem(String slug, String name, String role, String reason) {
    }

    /** 组装精灵清单（含 slug，供 GLM 返回时引用）：slug, 名字(属性, 种族值)。 */
    private String buildPetsBlockWithSlug(List<String> slugs) {
        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery().in(Pet::getSlug, slugs));
        if (pets.isEmpty()) return "（用户未提供任何精灵）";
        Map<Long, List<String>> typeNames = loadTypeNames(pets.stream().map(Pet::getId).toList());
        return pets.stream()
                .map(p -> {
                    List<String> types = typeNames.getOrDefault(p.getId(), List.of());
                    String stats = p.getBaseStats() == null ? "" : " 种族值" + p.getBaseStats().toString();
                    return p.getSlug() + ", " + p.getName() + "（"
                            + (types.isEmpty() ? "未知" : String.join("/", types)) + "系"
                            + (p.getStage() != null ? " " + p.getStage() + "阶" : "") + stats + "）";
                })
                .collect(Collectors.joining("\n"));
    }

    /** 组装精灵清单文本：名字(属性, 种族值摘要)。 */
    private String buildPetsBlock(List<String> slugs) {
        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery().in(Pet::getSlug, slugs));
        if (pets.isEmpty()) {
            return "（用户未提供任何精灵）";
        }
        // 批量取属性
        Map<Long, List<String>> typeNames = loadTypeNames(pets.stream().map(Pet::getId).toList());
        return pets.stream()
                .map(p -> {
                    List<String> types = typeNames.getOrDefault(p.getId(), List.of());
                    String stats = p.getBaseStats() == null ? "" : " 种族值" + p.getBaseStats().toString();
                    return "- " + p.getName() + "（" + (types.isEmpty() ? "未知" : String.join("/", types)) + "系"
                            + (p.getStage() != null ? " " + p.getStage() + "阶" : "") + stats + "）";
                })
                .collect(Collectors.joining("\n"));
    }

    private Map<Long, List<String>> loadTypeNames(List<Long> petIds) {
        List<PetType> rels = petTypeMapper.selectList(
                Wrappers.<PetType>lambdaQuery().in(PetType::getPetId, petIds).orderByAsc(PetType::getSlot));
        if (rels.isEmpty()) return Map.of();
        Map<Long, Type> typeById = typeMapper.selectBatchIds(rels.stream().map(PetType::getTypeId).distinct().toList())
                .stream().collect(Collectors.toMap(Type::getId, t -> t));
        Map<Long, List<String>> out = new java.util.HashMap<>();
        for (PetType r : rels) {
            Type t = typeById.get(r.getTypeId());
            if (t != null) out.computeIfAbsent(r.getPetId(), k -> new java.util.ArrayList<>()).add(t.getName());
        }
        return out;
    }
}
