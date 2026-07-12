package com.spiritdex.api.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * 嵌入服务：调用本地 Python sentence-transformers 服务（BAAI/bge-small-zh-v1.5，512 维）。
 *
 * <p>替代智谱 GLM embedding-3（付费）。本地零成本，chat 仍用 GLM。
 * 向量维度 512（bge-small-zh），与历史 1024 维不兼容——切换时需重建索引（见 V8 迁移）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final AiProperties props;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 把文本转成 512 维向量（float[]）。 */
    public float[] embed(String text) {
        try {
            RestClient client = RestClient.create();
            String resp = client.post()
                    .uri(props.getLocalEmbeddingUrl() + "/v1/embeddings")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"input\":\"" + escape(text) + "\"}")
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(resp);
            JsonNode arr = root.path("data").get(0).path("embedding");
            float[] vec = new float[arr.size()];
            for (int i = 0; i < arr.size(); i++) vec[i] = (float) arr.get(i).asDouble();
            return vec;
        } catch (Exception e) {
            throw new RuntimeException("本地 embedding 失败（确认服务在 " + props.getLocalEmbeddingUrl() + " 运行）: " + e.getMessage(), e);
        }
    }

    /** 把向量转成 pgvector 字符串字面量 '[0.1,0.2,...]'。 */
    public static String toVectorLiteral(float[] vec) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vec.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(vec[i]);
        }
        return sb.append("]").toString();
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
