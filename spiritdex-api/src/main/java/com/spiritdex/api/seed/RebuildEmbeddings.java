package com.spiritdex.api.seed;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.EmbeddingService;
import com.spiritdex.api.ai.Prompts;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.entity.PetType;
import com.spiritdex.api.entity.Type;
import com.spiritdex.api.mapper.EmbeddingMapper;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetTypeMapper;
import com.spiritdex.api.mapper.TypeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 重建文字 embedding（修复 vision-seed 污染）。
 *
 * <p>背景：vision-seed 错误地把视觉描述写入了 chunk_text + embedding 列（文字 RAG 被污染）。
 * 本 runner 从 pet 表重建原始文字 chunk（名字+属性+阶段+描述），重新 embed，恢复 embedding 列。
 * 视觉向量已在 V7 迁移保留到 visual_embedding 列，不受影响。
 *
 * <p>仅在 {@code rebuild-text} profile 下激活：
 * <pre>{@code GLM_API_KEY=xxx mvn spring-boot:run -Dspring-boot.run.profiles=rebuild-text}</pre>
 */
@Slf4j
@Component
@Profile("rebuild-text")
@RequiredArgsConstructor
public class RebuildEmbeddings implements CommandLineRunner {

    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final TypeMapper typeMapper;
    private final EmbeddingMapper embeddingMapper;
    private final EmbeddingService embeddingService;
    private final AiProperties props;

    @Override
    public void run(String... args) {
        if (!props.isEnabled()) {
            log.error("[rebuild-text] GLM 未启用，跳过");
            return;
        }
        log.info("[rebuild-text] 开始重建文字 embedding（修复污染）");

        Map<Long, List<String>> typeNames = loadTypeNames();
        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getDexNo).orderByAsc(Pet::getDexNo));

        int ok = 0, fail = 0;
        for (int i = 0; i < pets.size(); i++) {
            Pet pet = pets.get(i);
            try {
                List<String> types = typeNames.getOrDefault(pet.getId(), List.of());
                String chunk = Prompts.petChunk(pet.getName(), String.join(",", types),
                        pet.getStage() == null ? "" : pet.getStage() + "", pet.getDescription());
                float[] vec = embeddingService.embed(chunk);
                String literal = EmbeddingService.toVectorLiteral(vec);
                // 只更新 embedding 列 + chunk_text（恢复文字向量），不动 visual_embedding/visual_desc
                embeddingMapper.updateVector("pet", pet.getId(), chunk, literal, "embedding-3");
                ok++;
                if ((i + 1) % 50 == 0) log.info("[rebuild-text] 进度 {}/{} (ok={})", i + 1, pets.size(), ok);
                Thread.sleep(200);
            } catch (Exception e) {
                fail++;
                log.warn("[rebuild-text] {}({}) 失败: {}", pet.getName(), pet.getSlug(), e.getMessage());
            }
        }
        log.info("[rebuild-text] 完成。ok={} fail={}", ok, fail);
    }

    private Map<Long, List<String>> loadTypeNames() {
        List<PetType> rels = petTypeMapper.selectList(
                Wrappers.<PetType>lambdaQuery().orderByAsc(PetType::getSlot));
        Map<Long, Type> typeById = typeMapper.selectList(null).stream()
                .collect(Collectors.toMap(Type::getId, t -> t));
        Map<Long, List<String>> out = new HashMap<>();
        for (PetType r : rels) {
            Type t = typeById.get(r.getTypeId());
            if (t != null) out.computeIfAbsent(r.getPetId(), k -> new java.util.ArrayList<>()).add(t.getName());
        }
        return out;
    }
}
