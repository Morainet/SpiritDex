-- V6: embedding 表加 visual_desc（VLM 生成的视觉描述），用于同源图片识别。
--
-- 目的：图片识别时，用户上传图经 VLM 描述 → 与精灵立绘的 VLM 描述（本字段）做 embedding 匹配。
-- 两者都来自同一 VLM，语义空间一致，比"视觉描述 vs 游戏文字描述"准确得多。
-- visual_desc 由 VisionSeeder 一次性批量生成并缓存（固定成本）。
-- 注意：visual_desc 入库后，识别检索应基于 visual_desc 重新 embedding（见 VisionSeeder）。

ALTER TABLE embedding ADD COLUMN IF NOT EXISTS visual_desc TEXT;
COMMENT ON COLUMN embedding.visual_desc IS 'VLM 生成的立绘视觉描述（同源图片识别用）';
