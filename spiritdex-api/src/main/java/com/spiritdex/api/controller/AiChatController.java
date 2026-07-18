package com.spiritdex.api.controller;

import com.spiritdex.api.ai.AiProperties;
import com.spiritdex.api.ai.ChatService;
import com.spiritdex.api.ai.ChatService.HistoryMsg;
import com.spiritdex.api.ai.Retriever;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Tag(name = "AI 智能问答")
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final ChatService chatService;
    private final AiProperties props;

    /** 简单内存限流：IP → [时间窗起始, 计数]。 */
    private final Map<String, long[]> rateLimit = new ConcurrentHashMap<>();

    public record ChatRequest(String question, List<HistoryMsg> history, String sessionId) {
    }

    @GetMapping("/status")
    @Operation(summary = "AI 是否启用")
    public Map<String, Object> status() {
        return Map.of("enabled", props.isEnabled());
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "RAG 智能问答（SSE 流式）")
    public Flux<ServerSentEvent<String>> chat(@RequestBody ChatRequest req) {
        if (req.question() == null || req.question().isBlank()) {
            return Flux.just(sse("error", "问题不能为空"));
        }
        if (!props.isEnabled()) {
            return Flux.just(sse("delta", "AI 问答暂未启用（未配置 GLM API key）。配置后即可使用。"), sse("done", "1"));
        }
        // 限流（前端无账号，用客户端 IP 近似）
        if (!tryAcquire("default")) {
            return Flux.just(sse("error", "提问过于频繁，请稍后再试（每小时" + props.getRateLimitPerHour() + "次）"));
        }

        List<Retriever.Snippet>[] refsHolder = new List[]{List.of()};
        return chatService.streamChat(req.question(), req.history(), refs -> refsHolder[0] = refs)
                // 每个 token 增量作为一个 data 事件
                .map(token -> sse("delta", token))
                // 流末发 refs（来源）和 done
                .concatWith(Flux.defer(() -> {
                    String refsJson = refsHolder[0].stream()
                            .map(s -> String.format("{\"slug\":\"%s\",\"name\":\"%s\"}", s.slug(), s.name()))
                            .reduce((a, b) -> a + "," + b)
                            .map(x -> "[" + x + "]")
                            .orElse("[]");
                    return Flux.just(sse("refs", refsJson), sse("done", "1"));
                }))
                .onErrorResume(e -> {
                    log.error("[ai] 问答失败: {}", e.getMessage(), e);
                    return Flux.just(sse("error", "AI 服务暂时不可用，请稍后再试"));
                })
                // 防止长时间挂起（30s）
                .timeout(Duration.ofSeconds(30), Flux.just(sse("error", "响应超时")));
    }

    private boolean tryAcquire(String key) {
        long[] st = rateLimit.computeIfAbsent(key, k -> new long[]{System.currentTimeMillis(), 0});
        long now = System.currentTimeMillis();
        if (now - st[0] > 3_600_000L) {
            st[0] = now;
            st[1] = 0;
        }
        st[1]++;
        return st[1] <= props.getRateLimitPerHour();
    }

    private static ServerSentEvent<String> sse(String event, String data) {
        return ServerSentEvent.<String>builder().event(event).data(data).build();
    }
}
