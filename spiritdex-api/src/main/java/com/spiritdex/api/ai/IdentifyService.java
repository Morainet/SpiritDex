package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.mapper.EmbeddingMapper;
import com.spiritdex.api.mapper.PetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.content.Media;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 图片识别精灵：两阶段——
 * <ol>
 *   <li>GLM-4V 描述图片外形 → embedding 检索粗筛 top3 候选</li>
 *   <li>GLM-4v-plus 带着 3 个候选名 + 原图做「3 选 1」（把开放识别降维成选择题，准确率显著提升）</li>
 * </ol>
 *
 * <p>诊断依据：开放识别会幻觉（把喵喵认成"斯考特"）；给 5 个候选能选对；
 * 候选太多(8+)又乱。故固定 top3 做约束选择。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IdentifyService {

    private final OpenAiChatModel chatModel;
    private final PetMapper petMapper;
    private final Retriever retriever;
    private final EmbeddingMapper embeddingMapper;
    private final EmbeddingService embeddingService;

    public record Candidate(String slug, String name, String illustrationKey, double score) {
    }

    public record IdentifyResult(String vlmDescription, List<Candidate> candidates) {
    }

    public IdentifyResult identify(byte[] imageBytes, String mimeType) {
        // 1. GLM-4V 描述图片（用于展示 + 作为检索查询文本）
        String description = describeImage(imageBytes, mimeType);
        log.info("[identify] GLM-4V 描述: {}", description);

        // 2. 同源视觉匹配：优先用立绘视觉描述检索（vision-seed 生成的同源向量）
        //    若视觉描述数据未就绪，回退到普通精灵检索
        List<Candidate> candidates = searchByVisual(description);
        if (candidates.isEmpty()) {
            // 回退：普通检索（精灵文字 chunk）
            List<Retriever.Snippet> snippets = retriever.retrieve(description);
            candidates = toCandidates(snippets);
        }
        if (candidates.isEmpty()) {
            return new IdentifyResult(description, List.of());
        }

        // 3. 二阶段：glm-4v-flash 在 top3 候选里做「N 选 1」，把选中的置顶
        if (candidates.size() >= 2) {
            Candidate picked = pickFromCandidates(imageBytes, mimeType, candidates);
            if (picked != null) {
                List<Candidate> reordered = new ArrayList<>();
                reordered.add(new Candidate(picked.slug(), picked.name(), picked.illustrationKey(), 1.0));
                for (Candidate c : candidates) {
                    if (!c.slug().equals(picked.slug())) reordered.add(c);
                }
                candidates = reordered;
                log.info("[identify] VLM 二阶段选中: {}", picked.name());
            }
        }
        return new IdentifyResult(description, candidates);
    }

    /** 同源视觉检索：用立绘视觉描述的向量（visual_embedding 列）匹配。 */
    private List<Candidate> searchByVisual(String description) {
        float[] qvec;
        try {
            qvec = embeddingService.embed(description);
        } catch (Exception e) {
            return List.of();
        }
        String literal = EmbeddingService.toVectorLiteral(qvec);
        List<Map<String, Object>> rows = embeddingMapper.searchByVisualEmbedding("pet", literal, 3);
        return rows.stream().map(r -> {
            Long petId = ((Number) r.get("entityId")).longValue();
            Pet p = petMapper.selectOne(Wrappers.<Pet>lambdaQuery().eq(Pet::getId, petId));
            double sim = ((Number) r.get("similarity")).doubleValue();
            return new Candidate(p != null ? p.getSlug() : "", p != null ? p.getName() : "?",
                    p != null ? p.getIllustrationKey() : null, sim);
        }).toList();
    }

    /** 调 GLM-4v-flash 描述图片中的精灵外形特征（带重试，应对智谱侧 429 限流）。 */
    private String describeImage(byte[] imageBytes, String mimeType) {
        Media media = Media.builder()
                .mimeType(MimeType.valueOf(mimeType))
                .data(new ByteArrayResource(imageBytes))
                .build();
        UserMessage userMsg = UserMessage.builder()
                .text("这是一张游戏《洛克王国手游》里的精灵图片。请描述它的外形特征（颜色、形态、特征）。")
                .media(List.of(media))
                .build();
        Prompt prompt = new Prompt(List.of(
                new SystemMessage("你是游戏精灵识别助手。根据图片客观描述精灵的外形特征。"),
                userMsg
        ), OpenAiChatOptions.builder().model("glm-4v-flash").build());
        return callWithRetry(prompt, 3);
    }

    /** 带重试的 chat 调用（429/超时自动退避重试）。 */
    private String callWithRetry(Prompt prompt, int retries) {
        RuntimeException last = null;
        for (int i = 0; i < retries; i++) {
            try {
                ChatResponse resp = chatModel.call(prompt);
                String text = resp.getResult().getOutput().getText();
                return text == null ? "" : text;
            } catch (RuntimeException e) {
                last = e;
                log.warn("[identify] 第{}次调用失败，{}ms 后重试: {}", i + 1, 800L * (i + 1), e.getMessage());
                try {
                    Thread.sleep(800L * (i + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        throw last != null ? last : new RuntimeException("VLM 调用失败");
    }

    /** 二阶段：glm-4v-flash 看着原图，从候选名字里选最可能的一个。候选控制在 3 个以内。 */
    private Candidate pickFromCandidates(byte[] imageBytes, String mimeType, List<Candidate> candidates) {
        List<Candidate> top = candidates.size() > 3 ? candidates.subList(0, 3) : candidates;
        String nameOptions = top.stream().map(Candidate::name).reduce((a, b) -> a + "、").orElse("");
        String hint = "这是洛克王国手游里的精灵。请从下列名字中选出与图片最相符的一个，"
                + "只回答名字本身，不要加任何解释：" + nameOptions;

        Media media = Media.builder()
                .mimeType(MimeType.valueOf(mimeType))
                .data(new ByteArrayResource(imageBytes))
                .build();
        UserMessage userMsg = UserMessage.builder().text(hint).media(List.of(media)).build();
        Prompt prompt = new Prompt(List.of(
                new SystemMessage("你是精灵识别助手。从给定候选中选最匹配图片的一个。"),
                userMsg
        ), OpenAiChatOptions.builder().model("glm-4v-flash").build());

        try {
            String answer = callWithRetry(prompt, 3);
            if (answer == null || answer.isBlank()) return null;
            // 模糊匹配候选名（VLM 可能带标点/多余字）
            String clean = answer.replaceAll("[\"'。.!！?？\\s]", "").trim();
            for (Candidate c : top) {
                if (clean.contains(c.name()) || c.name().contains(clean)) {
                    return c;
                }
            }
        } catch (Exception e) {
            log.warn("[identify] 二阶段选择失败: {}", e.getMessage());
        }
        return null;
    }

    private List<Candidate> toCandidates(List<Retriever.Snippet> snippets) {
        return snippets.stream()
                .limit(3)
                .map(s -> {
                    Pet p = petMapper.selectOne(Wrappers.<Pet>lambdaQuery().eq(Pet::getId, s.petId()));
                    return new Candidate(s.slug(), s.name(),
                            p != null ? p.getIllustrationKey() : null, s.similarity());
                })
                .toList();
    }
}
