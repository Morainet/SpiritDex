package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spiritdex.api.ai.AiProperties.ArticleGeneration;
import com.spiritdex.api.entity.Article;
import com.spiritdex.api.mapper.ArticleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 活动攻略自动生成（计算型差异化内容）。
 *
 * <p>两条生成路径：
 * <ol>
 *   <li><b>活动打手分析</b>：读 activities.json → 提取 boss 属性 →
 *       {@link ActivityAnalysisService#analyzeCounters} 扫全库算克制打手排行 →
 *       调 GLM 解读计算结果写成攻略（category=活动，slug 前缀 event-）</li>
 *   <li><b>每周培养榜</b>（不依赖活动源，BWIKI 做不到的独家内容）：
 *       {@link ActivityAnalysisService#weeklyTrainingBoard} 按种族值+进化阶段+稀有度
 *       扫全库排序 → GLM 解读（category=进阶，slug 前缀 weekly-，每周唯一）</li>
 * </ol>
 *
 * <p>差异化核心：SpiritDex 把 BWIKI 给不了的「计算结果」（谁克制 boss、这周练谁）
 * 作为攻略主体，AI 只负责解读，不负责编造。
 *
 * <p>守卫：{@link AiProperties#isEnabled()} 为 false（无 GLM key）时直接跳过，不阻塞调用方。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ArticleGenerationService {

    private final OpenAiChatModel chatModel;
    private final ArticleMapper articleMapper;
    private final AiProperties aiProps;
    private final ActivityAnalysisService analysisService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 单次生成结果。 */
    public record GenerationResult(int attempted, int generated, int skipped, List<String> slugs) {
    }

    /**
     * 主入口：读活动源、生成攻略、落 draft。
     *
     * @return 生成结果汇总（供管理端点/定时任务日志使用）
     */
    public GenerationResult generateLatest() {
        if (!aiProps.isEnabled()) {
            log.warn("[article-gen] AI 未启用（无有效 GLM_API_KEY），跳过");
            return new GenerationResult(0, 0, 0, List.of());
        }
        ArticleGeneration cfg = aiProps.getArticleGeneration();
        List<Activity> activities = loadActivities(cfg.getActivitiesFile());

        // 活动源为空时退化为固定话题（保证任务始终有产出）
        boolean fallback = activities.isEmpty();
        if (fallback) {
            log.warn("[article-gen] 无活动数据，启用备用话题");
            activities = cfg.getFallbackTopics().stream()
                    .map(t -> new Activity(t, null, null, null, null))
                    .toList();
        }

        int limit = Math.min(cfg.getMaxArticlesPerRun(), activities.size());
        int generated = 0, skipped = 0;
        List<String> slugs = new ArrayList<>();
        for (int i = 0; i < limit; i++) {
            Activity act = activities.get(i);
            try {
                String slug = generateOne(act, cfg);
                if (slug != null) {
                    generated++;
                    slugs.add(slug);
                } else {
                    skipped++;
                }
            } catch (Exception e) {
                log.error("[article-gen] 生成失败 [{}]: {}", act.name(), e.getMessage());
                skipped++;
            }
        }

        // 差异化内容：追加本周培养榜（BWIKI 做不到的计算型推荐，每周一篇，当周未生成才跑）
        try {
            String weeklySlug = generateWeeklyBoard(cfg);
            if (weeklySlug != null) {
                generated++;
                slugs.add(weeklySlug);
            } else {
                skipped++;
            }
        } catch (Exception e) {
            log.error("[article-gen] 每周培养榜生成失败: {}", e.getMessage());
            skipped++;
        }

        log.info("[article-gen] 完成：生成 {} 篇，跳过 {} 篇", generated, skipped);
        return new GenerationResult(limit + 1, generated, skipped, slugs);
    }

    /**
     * 生成单篇活动攻略并落库。
     *
     * <p>差异化逻辑：从活动信息中尝试提取 boss/精灵属性，若提取到则用
     * {@link ActivityAnalysisService#analyzeCounters} 计算打手排行 + 评级，
     * 走打手分析模板；否则回退到通用活动攻略。计算结果是 SpiritDex 区别于
     * BWIKI 的核心——把"活动是什么"变成"该怎么打"。
     *
     * @return 新文章 slug；null 表示因重复跳过
     */
    private String generateOne(Activity act, ArticleGeneration cfg) {
        String activityInfo = buildActivityInfo(act);

        // 差异化核心：从活动文本里提取 boss 属性，计算打手排行
        List<String> bossTypes = extractBossTypes(act);
        String counterText;
        String evaluationText = "";
        if (!bossTypes.isEmpty()) {
            ActivityAnalysisService.CounterAnalysis analysis =
                    analysisService.analyzeCounters(bossTypes, cfg.getCounterTopN());
            counterText = ActivityAnalysisService.renderCounters(analysis);
            log.info("[article-gen] 活动 [{}] 提取 boss 属性 {}，命中 {} 打手",
                    act.name(), bossTypes, analysis.topCounters().size());
        } else {
            counterText = "（未从活动信息识别出 boss 属性，跳过打手计算）";
        }

        String userContent = String.format(Prompts.ARTICLE_COUNTER_TEMPLATE,
                activityInfo, counterText, evaluationText);

        Prompt prompt = new Prompt(List.of(
                new SystemMessage(Prompts.ARTICLE_SYSTEM),
                new UserMessage(userContent)
        ));
        String raw = callWithRetry(prompt, 3);
        StructuredArticle sa = parse(raw);
        if (sa == null || sa.title() == null || sa.title().isBlank()
                || sa.content() == null || sa.content().isBlank()) {
            throw new RuntimeException("GLM 返回内容无法解析: " + abbreviate(raw));
        }

        String slug = buildSlug("event", sa.title());
        if (slug == null) {
            throw new RuntimeException("slug 生成失败，标题: " + sa.title());
        }

        // 查重：同 slug 已存在则跳过
        Article existing = articleMapper.selectOne(
                Wrappers.<Article>lambdaQuery().eq(Article::getSlug, slug));
        if (existing != null) {
            log.info("[article-gen] slug={} 已存在，跳过", slug);
            return null;
        }

        Article e = new Article();
        e.setSlug(slug);
        e.setTitle(sa.title().trim());
        e.setSummary(sa.summary() == null || sa.summary().isBlank()
                ? abbreviate(sa.content()) : sa.summary().trim());
        e.setContent(sa.content().trim());
        e.setCategory("活动");
        e.setTags(normalizeTags(sa.tags()));
        e.setAuthorName(cfg.getAuthorName());
        e.setStatus("draft");
        e.setAiGenerated(true);
        e.setSourceUrl(act.sourceUrl());
        articleMapper.insert(e);
        log.info("[article-gen] 落库 draft: slug={} title={}", slug, e.getTitle());
        return slug;
    }

    /**
     * 生成每周培养榜（差异化王牌内容，不依赖活动源）。
     *
     * <p>BWIKI 作为静态百科永远不会产出"这周练谁"——这需要扫全库计算，
     * 是 SpiritDex 结构化数据 + 计算能力的独家输出。
     *
     * @return slug；null 表示本周已生成过
     */
    private String generateWeeklyBoard(ArticleGeneration cfg) {
        // slug 用本周一的日期，保证每周唯一、不重复生成
        String weekId = thisWeekId();
        String slug = "weekly-" + weekId;
        Article existing = articleMapper.selectOne(
                Wrappers.<Article>lambdaQuery().eq(Article::getSlug, slug));
        if (existing != null) {
            log.info("[article-gen] 本周培养榜 {} 已存在，跳过", slug);
            return null;
        }

        List<ActivityAnalysisService.TrainingPick> board =
                analysisService.weeklyTrainingBoard(cfg.getWeeklyTopN());
        String boardText = ActivityAnalysisService.renderBoard(board);
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        String userContent = String.format(Prompts.ARTICLE_WEEKLY_TEMPLATE, boardText, today);
        Prompt prompt = new Prompt(List.of(
                new SystemMessage(Prompts.ARTICLE_SYSTEM),
                new UserMessage(userContent)
        ));
        String raw = callWithRetry(prompt, 3);
        StructuredArticle sa = parse(raw);
        if (sa == null || sa.content() == null || sa.content().isBlank()) {
            throw new RuntimeException("培养榜 GLM 返回无法解析: " + abbreviate(raw));
        }

        Article e = new Article();
        e.setSlug(slug);
        e.setTitle(sa.title() == null || sa.title().isBlank()
                ? "本周精灵培养优先级榜" : sa.title().trim());
        e.setSummary(sa.summary() == null || sa.summary().isBlank()
                ? abbreviate(sa.content()) : sa.summary().trim());
        e.setContent(sa.content().trim());
        e.setCategory("进阶"); // 培养榜归进阶类，区别于活动攻略
        e.setTags(normalizeTags(sa.tags()));
        e.setAuthorName(cfg.getAuthorName());
        e.setStatus("draft");
        e.setAiGenerated(true);
        articleMapper.insert(e);
        log.info("[article-gen] 落库周榜 draft: slug={} title={}", slug, e.getTitle());
        return slug;
    }

    /** 拼装「活动信息」文本块（注入 prompt）。 */
    private String buildActivityInfo(Activity act) {
        StringBuilder sb = new StringBuilder();
        sb.append("活动名称：").append(act.name());
        if (act.start() != null || act.end() != null) {
            sb.append("\n活动时间：");
            if (act.start() != null) sb.append(act.start());
            if (act.end() != null) sb.append(" ~ ").append(act.end());
        }
        if (act.sourceUrl() != null) sb.append("\n来源：").append(act.sourceUrl());
        if (act.rawText() != null && !act.rawText().isBlank()) {
            sb.append("\n活动详情原文（截断 800 字）：\n")
                    .append(abbreviate(act.rawText(), 800));
        }
        return sb.toString();
    }

    /**
     * 从活动信息提取 boss/目标属性。
     * 查找活动名和原文里的「X系」字样（如"暗系""龙系"），用于打手分析。
     * 与 TypeContextProvider 的正则保持一致的属性集。
     */
    private List<String> extractBossTypes(Activity act) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(草|火|水|光|地|冰|龙|电|毒|虫|武|翼|萌|幽|恶|机械|幻)系");
        String text = (act.name() == null ? "" : act.name())
                + " " + (act.rawText() == null ? "" : act.rawText());
        List<String> found = new ArrayList<>();
        java.util.regex.Matcher m = p.matcher(text);
        while (m.find()) {
            String t = m.group(1) + "系";
            if (!found.contains(t)) found.add(t);
        }
        return found;
    }

    /** 本周一的日期标识（yyyy-MM-dd），用于培养榜 slug 保证每周唯一。 */
    private static String thisWeekId() {
        LocalDate today = LocalDate.now();
        // 本周一：today 减去 (周几-1) 天（周一=1）
        int dayOfWeek = today.getDayOfWeek().getValue(); // 周一=1 ... 周日=7
        return today.minusDays(dayOfWeek - 1).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    /** 带重试的 chat 调用（429/超时退避），仿 IdentifyService.callWithRetry。 */
    private String callWithRetry(Prompt prompt, int retries) {
        RuntimeException last = null;
        for (int i = 0; i < retries; i++) {
            try {
                ChatResponse resp = chatModel.call(prompt);
                String text = resp.getResult().getOutput().getText();
                return text == null ? "" : text;
            } catch (RuntimeException e) {
                last = e;
                log.warn("[article-gen] 第{}次调用失败，{}ms 后重试: {}", i + 1, 800L * (i + 1), e.getMessage());
                try {
                    Thread.sleep(800L * (i + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        throw last != null ? last : new RuntimeException("GLM 调用失败");
    }

    /** 解析 GLM 的结构化输出。容错：缺失分隔符时把全文当 content，首行当 title。 */
    private StructuredArticle parse(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String title = extract(raw, "TITLE", "SUMMARY");
        String summary = extract(raw, "SUMMARY", "TAGS");
        String tags = extract(raw, "TAGS", "CONTENT");
        String content = extract(raw, "CONTENT", "END");
        if (content == null || content.isBlank()) {
            // END 分隔符缺失时取 CONTENT 之后的所有内容
            content = afterMarker(raw, "CONTENT");
        }
        // 兜底：完全没有分隔符
        if (title == null && content == null) {
            String[] lines = raw.strip().split("\n", 2);
            title = lines[0].replaceAll("^#+\\s*", "").trim();
            content = lines.length > 1 ? lines[1].trim() : raw.trim();
        }
        return new StructuredArticle(title, summary, tags, content);
    }

    /** 提取两个分隔符之间的内容。 */
    private String extract(String raw, String startMarker, String endMarker) {
        String start = "<<<" + startMarker + ">>>";
        String end = "<<<" + endMarker + ">>>";
        int s = raw.indexOf(start);
        if (s < 0) return null;
        int e = raw.indexOf(end, s + start.length());
        if (e < 0) return null;
        return raw.substring(s + start.length(), e).trim();
    }

    /** 取某分隔符之后的所有内容（兜底，无结束分隔符时）。 */
    private String afterMarker(String raw, String marker) {
        String start = "<<<" + marker + ">>>";
        int s = raw.indexOf(start);
        if (s < 0) return null;
        return raw.substring(s + start.length()).trim();
    }

    /** 生成 slug：{prefix}-{yyyyMMdd}-{hash8}。prefix 区分活动(event)/周榜(weekly)。 */
    private static String buildSlug(String prefix, String title) {
        if (title == null || title.isBlank()) return null;
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE); // yyyyMMdd
        int hash = Math.abs(title.trim().hashCode());
        String ident = Integer.toHexString(hash);
        if (ident.length() > 8) ident = ident.substring(0, 8);
        else ident = String.format("%8s", ident).replace(' ', '0');
        return prefix + "-" + date + "-" + ident;
    }

    /** 解析 tags 字段（逗号分隔），去重、限 5 个。 */
    private List<String> normalizeTags(String tags) {
        if (tags == null || tags.isBlank()) return List.of("活动");
        Set<String> seen = new LinkedHashSet<>();
        Arrays.stream(tags.split("[,，、]"))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && s.length() <= 16)
                .limit(5)
                .forEach(seen::add);
        if (seen.isEmpty()) seen.add("活动");
        return new ArrayList<>(seen);
    }

    /** 读 activities.json（scraper 产物）。结构：{meta, items:[{name,start,end,source_url,raw_text}]}。 */
    private List<Activity> loadActivities(String path) {
        File f = new File(path);
        if (!f.exists()) {
            log.warn("[article-gen] 活动数据文件不存在: {}", f.getAbsolutePath());
            return List.of();
        }
        try {
            byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
            JsonNode root = objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8));
            JsonNode items = root.path("items");
            if (!items.isArray() || items.isEmpty()) return List.of();
            List<Activity> out = new ArrayList<>();
            for (JsonNode it : items) {
                String name = text(it, "name");
                if (name == null || name.isBlank()) continue;
                out.add(new Activity(
                        name,
                        text(it, "start"),
                        text(it, "end"),
                        text(it, "source_url"),
                        text(it, "raw_text")
                ));
            }
            return out;
        } catch (Exception e) {
            log.warn("[article-gen] 解析 activities.json 失败: {}", e.getMessage());
            return List.of();
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String abbreviate(String s) {
        return abbreviate(s, 80);
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /** 活动数据（来自 scraper activities.json）。 */
    private record Activity(String name, String start, String end, String sourceUrl, String rawText) {
    }

    /** GLM 返回的结构化文章。 */
    private record StructuredArticle(String title, String summary, String tags, String content) {
    }
}
