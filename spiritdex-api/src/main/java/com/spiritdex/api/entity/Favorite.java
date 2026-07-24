package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户收藏（user_id + pet_slug）。Phase 7 第二期。
 */
@Data
@TableName("favorite")
public class Favorite {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    /** 关联 pet.slug（逻辑关联，无 FK）。 */
    private String petSlug;

    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
