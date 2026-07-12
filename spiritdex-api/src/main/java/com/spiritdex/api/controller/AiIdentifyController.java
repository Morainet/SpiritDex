package com.spiritdex.api.controller;

import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.IdentifyService;
import com.spiritdex.api.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Tag(name = "AI 图片识别")
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiIdentifyController {

    private final IdentifyService identifyService;
    private final AiProperties props;

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SIZE = 5 * 1024 * 1024; // 5MB

    @PostMapping("/identify")
    @Operation(summary = "上传精灵截图，AI 识别候选精灵")
    public Result<Map<String, Object>> identify(@RequestParam("file") MultipartFile file) {
        if (!props.isEnabled()) {
            return Result.error(400, "AI 识别暂未启用（未配置 GLM API key）");
        }
        if (file == null || file.isEmpty()) {
            return Result.error(400, "请上传图片");
        }
        if (file.getSize() > MAX_SIZE) {
            return Result.error(400, "图片过大（≤5MB）");
        }
        String mime = file.getContentType();
        if (mime == null || !ALLOWED.contains(mime)) {
            return Result.error(400, "仅支持 JPG/PNG/WebP 格式");
        }

        try {
            IdentifyService.IdentifyResult r = identifyService.identify(file.getBytes(), mime);
            List<Map<String, Object>> candidates = r.candidates().stream()
                    .map(c -> Map.<String, Object>of(
                            "slug", c.slug(),
                            "name", c.name(),
                            "score", Math.round(c.score() * 100),
                            "illustrationKey", c.illustrationKey() == null ? "" : c.illustrationKey()))
                    .toList();
            return Result.success(Map.of(
                    "vlmDescription", r.vlmDescription(),
                    "candidates", candidates
            ));
        } catch (Exception e) {
            log.error("[ai] 识别失败: {}", e.getMessage(), e);
            return Result.error(500, "识别失败：" + e.getMessage());
        }
    }
}
