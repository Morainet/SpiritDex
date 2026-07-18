package com.spiritdex.api.controller;

import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.RecommendService;
import com.spiritdex.api.ai.RecommendService.RecommendItem;
import com.spiritdex.api.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.List;

@Tag(name = "AI 阵容推荐")
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiRecommendController {

    private final RecommendService recommendService;
    private final AiProperties props;

    public record RecommendRequest(List<String> ownedPets, String goal) {
    }

    @PostMapping(value = "/recommend", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "AI 阵容推荐（SSE 流式）")
    public Flux<ServerSentEvent<String>> recommend(@RequestBody RecommendRequest req) {
        if (!props.isEnabled()) {
            return Flux.just(sse("delta", "AI 推荐暂未启用（未配置 GLM API key）。"), sse("done", "1"));
        }
        if (req.ownedPets() == null || req.ownedPets().isEmpty()) {
            return Flux.just(sse("error", "请先选择你拥有的精灵"));
        }

        return recommendService.recommend(req.ownedPets(), req.goal())
                .map(token -> sse("delta", token))
                .concatWith(Flux.just(sse("done", "1")))
                .onErrorResume(e -> {
                    log.error("[ai] 推荐失败: {}", e.getMessage(), e);
                    return Flux.just(sse("error", "AI 服务暂时不可用，请稍后再试"));
                })
                .timeout(Duration.ofSeconds(45), Flux.just(sse("error", "响应超时")));
    }

    private static ServerSentEvent<String> sse(String event, String data) {
        return ServerSentEvent.<String>builder().event(event).data(data).build();
    }

    /**
     * 结构化阵容推荐（一次性 JSON，前端渲染成精灵卡片）。
     * 返回 Result&lt;List&lt;RecommendItem&gt;&gt;，每项含 slug/name/role/reason。
     */
    @PostMapping("/recommend-cards")
    @Operation(summary = "AI 阵容推荐（结构化 JSON 卡片）")
    public Result<List<RecommendItem>> recommendCards(@RequestBody RecommendRequest req) {
        if (!props.isEnabled()) {
            return Result.error(1, "AI 推荐暂未启用（未配置 GLM API key）");
        }
        if (req.ownedPets() == null || req.ownedPets().size() < 3) {
            return Result.error(1, "请至少选择 3 只精灵");
        }
        try {
            List<RecommendItem> cards = recommendService.recommendStructured(req.ownedPets(), req.goal());
            return Result.success(cards);
        } catch (Exception e) {
            log.error("[ai] 结构化推荐失败: {}", e.getMessage(), e);
            return Result.error(1, "AI 服务暂时不可用，请稍后再试");
        }
    }
}
