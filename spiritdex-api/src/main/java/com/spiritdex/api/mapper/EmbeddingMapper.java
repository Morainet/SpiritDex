package com.spiritdex.api.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 向量嵌入 Mapper —— 原生 SQL 操作 pgvector 列（MyBatis 不直接支持 vector 类型）。
 */
@Mapper
public interface EmbeddingMapper {

    /** 插入向量：vectorLiteral 为 '[0.1,0.2,...]' 字符串形式。 */
    @Insert("INSERT INTO embedding (entity_type, entity_id, slug, chunk_text, embedding, model) "
            + "VALUES (#{entityType}, #{entityId}, #{slug}, #{chunkText}, CAST(#{vectorLiteral} AS vector), #{model})")
    int insertVector(@Param("entityType") String entityType,
                     @Param("entityId") Long entityId,
                     @Param("slug") String slug,
                     @Param("chunkText") String chunkText,
                     @Param("vectorLiteral") String vectorLiteral,
                     @Param("model") String model);

    /** 更新向量（重建用）。 */
    @Update("UPDATE embedding SET chunk_text = #{chunkText}, "
            + "embedding = CAST(#{vectorLiteral} AS vector), model = #{model}, created_at = NOW() "
            + "WHERE entity_type = #{entityType} AND entity_id = #{entityId}")
    int updateVector(@Param("entityType") String entityType,
                     @Param("entityId") Long entityId,
                     @Param("chunkText") String chunkText,
                     @Param("vectorLiteral") String vectorLiteral,
                     @Param("model") String model);

    /** 是否已存在（幂等判断）。 */
    @Select("SELECT count(*) FROM embedding WHERE entity_type = #{entityType} AND entity_id = #{entityId}")
    int countByEntity(@Param("entityType") String entityType, @Param("entityId") Long entityId);

    /**
     * 余弦相似度检索 top-K：queryLiteral 为查询向量的字符串形式。
     * pgvector 的 &lt;=&gt; 操作符返回余弦距离（越小越相似），1 - 距离 = 相似度。
     */
    @Select("SELECT e.entity_id AS entityId, e.slug, e.chunk_text AS chunkText, "
            + "1 - (e.embedding <=> CAST(#{queryLiteral} AS vector)) AS similarity "
            + "FROM embedding e "
            + "WHERE e.entity_type = #{entityType} "
            + "ORDER BY e.embedding <=> CAST(#{queryLiteral} AS vector) "
            + "LIMIT #{topK}")
    List<Map<String, Object>> searchSimilar(@Param("entityType") String entityType,
                                            @Param("queryLiteral") String queryLiteral,
                                            @Param("topK") int topK);

    @Select("SELECT count(*) FROM embedding")
    long countAll();

    /** 更新 visual_desc（VLM 生成的立绘视觉描述）。 */
    @Update("UPDATE embedding SET visual_desc = #{visualDesc} WHERE entity_type = #{entityType} AND entity_id = #{entityId}")
    int updateVisualDesc(@Param("entityType") String entityType,
                         @Param("entityId") Long entityId,
                         @Param("visualDesc") String visualDesc);

    /**
     * 按 visual_desc 的 embedding 检索（图片识别专用）：
     * 若精灵已有 visual_desc，用它的向量；否则回退普通 chunk。
     * 这里简化为：取 visual_desc 非空的，按其当前 embedding 检索（VisionSeeder 会用 visual_desc 重 embed）。
     */
    @Select("SELECT e.entity_id AS \"entityId\", e.slug, "
            + "1 - (e.embedding <=> CAST(#{queryLiteral} AS vector)) AS similarity "
            + "FROM embedding e "
            + "WHERE e.entity_type = #{entityType} AND e.visual_desc IS NOT NULL "
            + "ORDER BY e.embedding <=> CAST(#{queryLiteral} AS vector) "
            + "LIMIT #{topK}")
    List<Map<String, Object>> searchByVisual(@Param("entityType") String entityType,
                                             @Param("queryLiteral") String queryLiteral,
                                             @Param("topK") int topK);

    /** 统计已有 visual_desc 的数量。 */
    @Select("SELECT count(*) FROM embedding WHERE entity_type = 'pet' AND visual_desc IS NOT NULL")
    long countVisualDesc();

    /** 单个实体是否已有 visual_desc（幂等判断）。 */
    @Select("SELECT count(*) FROM embedding WHERE entity_type = #{entityType} AND entity_id = #{entityId} AND visual_desc IS NOT NULL")
    int hasVisualDesc(@Param("entityType") String entityType, @Param("entityId") Long entityId);

    /** 写入视觉向量到 visual_embedding 列（与文字 embedding 分离，不污染文字 RAG）。 */
    @Update("UPDATE embedding SET visual_desc = #{visualDesc}, "
            + "visual_embedding = CAST(#{vectorLiteral} AS vector) "
            + "WHERE entity_type = #{entityType} AND entity_id = #{entityId}")
    int updateVisualEmbedding(@Param("entityType") String entityType,
                              @Param("entityId") Long entityId,
                              @Param("visualDesc") String visualDesc,
                              @Param("vectorLiteral") String vectorLiteral);

    /** 按视觉向量（visual_embedding）检索——图片识别专用。 */
    @Select("SELECT e.entity_id AS \"entityId\", e.slug, "
            + "1 - (e.visual_embedding <=> CAST(#{queryLiteral} AS vector)) AS similarity "
            + "FROM embedding e "
            + "WHERE e.entity_type = #{entityType} AND e.visual_embedding IS NOT NULL "
            + "ORDER BY e.visual_embedding <=> CAST(#{queryLiteral} AS vector) "
            + "LIMIT #{topK}")
    List<Map<String, Object>> searchByVisualEmbedding(@Param("entityType") String entityType,
                                                      @Param("queryLiteral") String queryLiteral,
                                                      @Param("topK") int topK);

    /**
     * 批量取多个实体的 chunk_text（供名字命中后补全文本）。
     * 每行：{entityId, chunkText}，调用方自行转 Map。
     */
    @Select("<script>SELECT entity_id AS \"entityId\", chunk_text AS \"chunkText\" FROM embedding "
            + "WHERE entity_type = #{entityType} AND entity_id IN "
            + "<foreach collection='entityIds' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    java.util.List<java.util.Map<String, Object>> chunksByEntityIds(
            @Param("entityType") String entityType, @Param("entityIds") java.util.List<Long> entityIds);
}
