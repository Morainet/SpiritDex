package com.spiritdex.api.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 图片代理：解决浏览器直连 BWIKI 并发加载被 WAF 限流（514/404）导致大量图片失败的问题。
 *
 * <p>前端不再直连 wiki.biligame.com，而是请求 {@code /api/image-proxy?key=Head_3001}，
 * 由后端：
 * <ol>
 *   <li>带浏览器 UA + Referer 请求 BWIKI（单线程，不受浏览器并发 WAF 限制）</li>
 *   <li>命中本地磁盘缓存直接返回（首次下载后，后续不再打 BWIKI）</li>
 *   <li>返回时带长缓存头（浏览器/CDN 二次缓存，秒回）</li>
 * </ol>
 *
 * <p>安全：key 仅允许字母/数字/下划线/连字符（防路径穿越和 SSRF）。
 */
@Slf4j
@RestController
@RequestMapping("/api/image-proxy")
public class ImageProxyController {

    @Value("${spiritdex.image-proxy.cache-dir:./image-cache}")
    private String cacheDir;

    @Value("${spiritdex.image-proxy.timeout:15}")
    private int timeoutSeconds;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** 失败 key 的短期记忆，避免连续重试打 BWIKI（如不存在的图片）。 */
    private final ConcurrentHashMap<String, Long> negativeCache = new ConcurrentHashMap<>();
    private static final long NEGATIVE_TTL_MS = 60_000L; // 1 分钟内不重试失败 key

    @GetMapping
    public ResponseEntity<byte[]> proxy(@RequestParam String key) {
        if (!isValidKey(key)) {
            return ResponseEntity.badRequest().build();
        }
        // 失败缓存：短时间内已失败的 key 直接返回占位图，不重复打 BWIKI
        Long failedAt = negativeCache.get(key);
        if (failedAt != null && System.currentTimeMillis() - failedAt < NEGATIVE_TTL_MS) {
            return placeholder();
        }

        // 1. 磁盘缓存命中？
        Path cached = cachePath(key);
        if (Files.exists(cached)) {
            try {
                byte[] data = Files.readAllBytes(cached);
                return ok(data, Files.probeContentType(cached));
            } catch (IOException e) {
                log.warn("[image-proxy] 读缓存失败 {}: {}", key, e.getMessage());
            }
        }

        // 2. 回源 BWIKI
        try {
            String url = "https://wiki.biligame.com/rocom/Special:FilePath/" + key + ".png";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    // 模拟真实浏览器完整请求头，降低被 EdgeOne WAF 识别为机器人拦截的概率
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                    .header("Referer", "https://wiki.biligame.com/rocom/")
                    .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("sec-ch-ua", "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\", \"Google Chrome\";v=\"126\"")
                    .header("sec-ch-ua-mobile", "?0")
                    .header("sec-ch-ua-platform", "\"Windows\"")
                    .header("Sec-Fetch-Dest", "image")
                    .header("Sec-Fetch-Mode", "no-cors")
                    .header("Sec-Fetch-Site", "cross-site")
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() != 200 || resp.body() == null || resp.body().length == 0) {
                log.debug("[image-proxy] 回源失败 {}: HTTP {}", key, resp.statusCode());
                negativeCache.put(key, System.currentTimeMillis());
                return placeholder();
            }
            byte[] body = resp.body();
            // ★ 关键校验：BWIKI 的 WAF 会返回 JS 挑战页（HTTP 200 但内容是 <script>，非真图片）。
            // 用 PNG magic bytes（\x89PNG）校验，非图片内容拒绝缓存、返回 404。
            if (!isPng(body)) {
                log.warn("[image-proxy] {} 被 WAF 拦截或不是图片（{}字节，非PNG头），返回占位图",
                        key, body.length);
                negativeCache.put(key, System.currentTimeMillis());
                return placeholder();
            }
            // 3. 写入磁盘缓存
            try {
                Files.createDirectories(cached.getParent());
                Files.write(cached, body);
            } catch (IOException e) {
                log.warn("[image-proxy] 写缓存失败 {}: {}", key, e.getMessage());
            }
            return ok(body, "image/png");
        } catch (Exception e) {
            log.warn("[image-proxy] 代理异常 {}: {}", key, e.getMessage());
            negativeCache.put(key, System.currentTimeMillis());
            return placeholder();
        }
    }

    /** PNG magic bytes 校验：真 PNG 以 89 50 4E 47 0D 0A 1A 0A 开头。 */
    private static boolean isPng(byte[] data) {
        return data != null && data.length >= 8
                && (data[0] & 0xFF) == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47
                && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A;
    }

    /**
     * 占位图：图片在 BWIKI 不存在时，返回 200 + 这张 SVG（透明背景 + 居中🐾），
     * 而非 404。这样浏览器原生 &lt;img&gt; 永远收到一张图，绝不显示破图，
     * 不依赖前端 onError（SSR 场景 onError 在 hydration 前不触发，会先闪破图）。
     * 用 no-store 避免占位图被长缓存（万一 BWIKI 后来补了图，能重新拉到真图）。
     */
    private static final byte[] PLACEHOLDER_SVG = (
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"96\" height=\"96\" viewBox=\"0 0 96 96\">"
            + "<text x=\"48\" y=\"62\" font-size=\"48\" text-anchor=\"middle\" opacity=\"0.25\">🐾</text>"
            + "</svg>").getBytes(java.nio.charset.StandardCharsets.UTF_8);

    private ResponseEntity<byte[]> placeholder() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("image/svg+xml"))
                .cacheControl(CacheControl.noStore())
                .body(PLACEHOLDER_SVG);
    }

    private ResponseEntity<byte[]> ok(byte[] data, String contentType) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        contentType != null && contentType.startsWith("image/") ? contentType : "image/png"))
                // 保留长缓存（性能），但去掉 immutable 并加 must-revalidate：
                // 这样后端修 bug 后，浏览器到期会重新验证，不会永久卡在旧的错误响应上。
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic().mustRevalidate())
                .body(data);
    }

    private Path cachePath(String key) {
        // 用 key 的最后一段做子目录分片，避免单目录文件过多
        String shard = key.length() >= 2 ? key.substring(key.length() - 2) : "00";
        return Path.of(cacheDir, shard, key + ".png");
    }

    /** key 白名单：仅字母数字下划线连字符，防路径穿越和 SSRF。 */
    private static boolean isValidKey(String key) {
        return key != null && !key.isBlank() && key.matches("[A-Za-z0-9_\\-]+") && key.length() <= 64;
    }
}
