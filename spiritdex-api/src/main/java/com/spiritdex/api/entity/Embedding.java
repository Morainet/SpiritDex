package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 向量嵌入（embedding）—— RAG 检索用，pgvector 1024 维。
 * embedding 列是 pgvector 类型，MyBatis 不直接映射，检索走原生 SQL（见 EmbeddingMapper）。
 */
@Data
@TableName("embedding")
public class Embedding {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** pet / skill / article。 */
    private String entityType;

    private Long entityId;

    private String slug;

    /** 被嵌入的文本块。 */
    private String chunkText;

    /** VLM 生成的立绘视觉描述（同源图片识别用，可空）。 */
    private String visualDesc;

    /** pgvector vector(1024)；Java 侧不读写（插入/检索走原生 SQL）。 */
    private Object embedding;

    private String model;

    private LocalDateTime createdAt;
}
