package com.spiritdex.api.seed;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.EmbeddingService;
import com.spiritdex.api.ai.Prompts;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.mapper.EmbeddingMapper;
import com.spiritdex.api.mapper.PetMapper;
import com.spiritdex.api.mapper.PetTypeMapper;
import com.spiritdex.api.mapper.TypeMapper;
import com.spiritdex.api.entity.PetType;
import com.spiritdex.api.entity.Type;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 精灵向量嵌入生成（Phase 5）。
 *
 * <p>仅在 {@code embed} profile 下激活：
 * <pre>{@code
 * GLM_API_KEY=xxx mvn spring-boot:run -Dspring-boot.run.profiles=embed
 * }</pre>
 *
 * <p>遍历全部精灵，拼接文本（名字+属性+阶段+描述）→ 调 GLM embedding-3(1024维) → 入库。
 * 幂等：已存在的 (entity_type=pet, entity_id) 跳过；--rebuild 重建。
 */
@Slf4j
@Component
@Profile("embed")
@RequiredArgsConstructor
public class EmbeddingSeeder implements CommandLineRunner {

    private final PetMapper petMapper;
    private final PetTypeMapper petTypeMapper;
    private final TypeMapper typeMapper;
    private final EmbeddingMapper embeddingMapper;
    private final EmbeddingService embeddingService;
    private final AiProperties props;

    @Override
    public void run(String... args) {
        if (!props.isEnabled()) {
            log.error("[embed] GLM 未启用（无有效 GLM_API_KEY），跳过。请设置环境变量 GLM_API_KEY");
            return;
        }
        boolean rebuild = args != null && List.of(args).contains("--rebuild");
        log.info("[embed] 开始生成精灵 embedding（rebuild={}）", rebuild);

        // 预载 pet_type 关联 + type 名字，避免逐条查询
        Map<Long, List<String>> typeNamesByPet = loadTypeNames();

        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getDexNo).orderByAsc(Pet::getDexNo));
        log.info("[embed] 共 {} 只精灵待处理", pets.size());

        int ok = 0, skip = 0, fail = 0;
        for (int i = 0; i < pets.size(); i++) {
            Pet pet = pets.get(i);
            try {
                if (!rebuild && embeddingMapper.countByEntity("pet", pet.getId()) > 0) {
                    skip++;
                    continue;
                }
                List<String> types = typeNamesByPet.getOrDefault(pet.getId(), List.of());
                String chunk = Prompts.petChunk(pet.getName(), String.join(",", types),
                        pet.getStage() == null ? "" : pet.getStage() + "", pet.getDescription());
                float[] vec = embeddingService.embed(chunk);
                String literal = EmbeddingService.toVectorLiteral(vec);

                if (embeddingMapper.countByEntity("pet", pet.getId()) > 0) {
                    embeddingMapper.updateVector("pet", pet.getId(), chunk, literal, "embedding-3");
                } else {
                    embeddingMapper.insertVector("pet", pet.getId(), pet.getSlug(), chunk, literal, "embedding-3");
                }
                ok++;
                if ((i + 1) % 50 == 0) {
                    log.info("[embed] 进度 {}/{} (ok={} skip={} fail={})", i + 1, pets.size(), ok, skip, fail);
                }
                // 控速，避免触发 GLM 限流
                Thread.sleep(200);
            } catch (Exception e) {
                fail++;
                log.warn("[embed] {}({}) 失败: {}", pet.getName(), pet.getSlug(), e.getMessage());
            }
        }
        log.info("[embed] 完成。ok={} skip={} fail={}", ok, skip, fail);
    }

    private Map<Long, List<String>> loadTypeNames() {
        List<PetType> rels = petTypeMapper.selectList(Wrappers.<PetType>lambdaQuery()
                .orderByAsc(PetType::getSlot));
        Map<Long, Type> typeById = typeMapper.selectList(null).stream()
                .collect(Collectors.toMap(Type::getId, t -> t));
        Map<Long, List<String>> out = new java.util.HashMap<>();
        for (PetType r : rels) {
            Type t = typeById.get(r.getTypeId());
            if (t != null) {
                out.computeIfAbsent(r.getPetId(), k -> new java.util.ArrayList<>()).add(t.getName());
            }
        }
        return out;
    }
}
