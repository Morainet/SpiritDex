package com.spiritdex.api.seed;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.EmbeddingService;
import com.spiritdex.api.entity.Embedding;
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
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeType;

import java.net.URI;
import java.util.List;

/**
 * 精灵立绘视觉描述生成（同源图片识别的关键数据）。
 *
 * <p>仅在 {@code vision-seed} profile 下激活：
 * <pre>{@code
 * GLM_API_KEY=xxx mvn spring-boot:run -Dspring-boot.run.profiles=vision-seed
 * }</pre>
 *
 * <p>遍历精灵，用 VLM 描述其立绘图 → 写入 embedding.visual_desc → 用该描述重新 embedding
 * （使向量来自视觉描述，与用户上传图的 VLM 描述同源，识别匹配更准）。
 * 幂等：已有 visual_desc 的跳过；--rebuild 重建。
 */
@Slf4j
@Component
@Profile("vision-seed")
@RequiredArgsConstructor
public class VisionSeeder implements CommandLineRunner {

    private static final String IMG_BASE = "https://wiki.biligame.com/rocom/Special:FilePath/";

    private final PetMapper petMapper;
    private final EmbeddingMapper embeddingMapper;
    private final EmbeddingService embeddingService;
    private final OpenAiChatModel chatModel;
    private final AiProperties props;

    @Override
    public void run(String... args) {
        if (!props.isEnabled()) {
            log.error("[vision-seed] GLM 未启用，跳过");
            return;
        }
        boolean rebuild = args != null && List.of(args).contains("--rebuild");
        int limit = parseIntArg(args, "limit", 50); // 每次最多处理 N 只（分批慢跑，避免 BWIKI 限流）
        int maxConsecFail = parseIntArg(args, "max-fail", 8); // 连续失败 N 次提前退出（限流保护）
        long existing = embeddingMapper.countVisualDesc();
        log.info("[vision-seed] 开始（rebuild={} limit={} maxFail={}），已有 {} 条", rebuild, limit, maxConsecFail, existing);

        List<Pet> pets = petMapper.selectList(Wrappers.<Pet>lambdaQuery()
                .isNotNull(Pet::getDexNo).orderByAsc(Pet::getDexNo));
        int ok = 0, skip = 0, fail = 0, processed = 0, consecFail = 0;
        for (int i = 0; i < pets.size() && processed < limit; i++) {
            Pet pet = pets.get(i);
            Long petId = pet.getId();
            // 连续失败保护：BWIKI 限流时提前退出，避免空转
            if (consecFail >= maxConsecFail) {
                log.warn("[vision-seed] 连续失败 {} 次，提前退出（疑似限流），本次 ok={} fail={}", consecFail, ok, fail);
                break;
            }
            try {
                int exist = embeddingMapper.countByEntity("pet", petId);
                if (exist == 0) { skip++; continue; }
                if (!rebuild && embeddingMapper.hasVisualDesc("pet", petId) > 0) { skip++; continue; }
                processed++;

                String imgKey = pet.getIllustrationKey() != null ? pet.getIllustrationKey() : pet.getHeadKey();
                if (imgKey == null) { skip++; consecFail = 0; continue; }

                // 立绘可能不存在（BWIKI 返回重定向 HTML 而非 404），下载后校验是否真图，失败回退 headKey
                String desc = describeImage(IMG_BASE + imgKey + ".png");
                if (desc == null && pet.getHeadKey() != null && !pet.getHeadKey().equals(imgKey)) {
                    desc = describeImage(IMG_BASE + pet.getHeadKey() + ".png"); // 回退到头像
                }
                if (desc == null || desc.isBlank()) {
                    fail++; consecFail = 0; continue; // 图不存在不算限流，重置 consecFail
                }
                float[] vec = embeddingService.embed(desc);
                String literal = EmbeddingService.toVectorLiteral(vec);
                embeddingMapper.updateVisualEmbedding("pet", petId, desc, literal);
                ok++; consecFail = 0;
                log.info("[vision-seed] +{} ({})", pet.getName(), pet.getSlug());
                Thread.sleep(1500); // 保守间隔（1.5s/张），降低 BWIKI 限流概率
            } catch (Exception e) {
                fail++; consecFail++;
                log.warn("[vision-seed] {}({}) 失败: {}", pet.getName(), pet.getSlug(), e.getMessage());
            }
        }
        log.info("[vision-seed] 本批结束。ok={} skip={} fail={}（总进度 {}/{}）",
                ok, skip, fail, existing + ok, pets.size());
    }

    /** 解析 --key=value 形式的参数。 */
    private static int parseIntArg(String[] args, String key, int def) {
        if (args == null) return def;
        for (String a : args) {
            if (a.startsWith("--" + key + "=")) {
                try { return Integer.parseInt(a.substring(key.length() + 3)); } catch (NumberFormatException ignored) {}
            }
        }
        return def;
    }

    /** VLM 描述图片外形。下载图片带重试退避（BWIKI 567 限流是瞬时的），再用 ByteArrayResource 传 VLM。 */
    private String describeImage(String imgUrl) {
        byte[] imageBytes = downloadWithRetry(imgUrl, 3);
        if (imageBytes == null || imageBytes.length == 0) return null;

        Media media = Media.builder()
                .mimeType(MimeType.valueOf("image/png"))
                .data(new ByteArrayResource(imageBytes))
                .build();
        UserMessage userMsg = UserMessage.builder()
                .text("用30字以内客观描述这个游戏角色的视觉外形：主要颜色、形态、明显特征。")
                .media(List.of(media))
                .build();
        Prompt prompt = new Prompt(List.of(
                new SystemMessage("你是图像描述助手，简洁客观描述角色外形。"),
                userMsg
        // 用 glm-4v-flash（免费档；plus 需付费 1113）
        ), OpenAiChatOptions.builder().model("glm-4v-flash").build());

        for (int i = 0; i < 3; i++) {
            try {
                ChatResponse resp = chatModel.call(prompt);
                String t = resp.getResult().getOutput().getText();
                return t == null ? "" : t;
            } catch (RuntimeException e) {
                log.warn("[vision-seed] VLM 第{}次失败: {}", i + 1, e.getMessage());
                try {
                    Thread.sleep(1000L * (i + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        return null;
    }

    /** 下载图片字节，带重试退避。校验是真图（PNG/JPG magic bytes），过滤 BWIKI 对不存在图返回的重定向 HTML。 */
    private byte[] downloadWithRetry(String imgUrl, int retries) {
        for (int i = 0; i < retries; i++) {
            try {
                java.net.URLConnection conn = URI.create(imgUrl).toURL().openConnection();
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (SpiritDexWikiBot/0.1)");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                byte[] data = conn.getInputStream().readAllBytes();
                // 校验是真图：PNG(89504E47) / JPG(FFD8) / WebP(RIFF...WEBP)
                if (data.length > 100 && isImage(data)) return data;
                // 不是图（HTML 重定向页），不重试直接返回 null
                return null;
            } catch (Exception e) {
                if (i < retries - 1) {
                    try {
                        Thread.sleep(2000L * (i + 1));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private static boolean isImage(byte[] data) {
        // PNG: 89 50 4E 47
        if (data.length >= 4 && data[0] == (byte) 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47) return true;
        // JPEG: FF D8 FF
        if (data.length >= 3 && data[0] == (byte) 0xFF && data[1] == (byte) 0xD8 && data[2] == (byte) 0xFF) return true;
        // WebP/GIF: RIFF / GIF8
        if (data.length >= 4 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F') return true;
        if (data.length >= 4 && data[0] == 'G' && data[1] == 'I' && data[2] == 'F') return true;
        return false;
    }
}
