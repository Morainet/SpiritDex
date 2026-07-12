# 灵宠档案（SpiritDex）实施方案

> **项目名称**：灵宠档案 / SpiritDex（洛克王国手游攻略站）

## Context

从零搭建**洛克王国手游**攻略站点——中文名「**灵宠档案**」，英文/目录名 `SpiritDex`，核心定位是「精灵图鉴 + 攻略 + 工具 + AI 能力」。需求已澄清：

- **架构**：前后端分离 — **Next.js 前端 + Spring Boot 后端**，REST API 通信
- **内容范围**：精灵图鉴 + 攻略文章 + 数据工具；MVP **不做账号/社区**
- **AI 能力**（后续接入）：智能问答/RAG + 阵容培养推荐 + 内容生成补全 + 图片识别/OCR，**首选国内模型**
- **数据来源**：从公开 wiki（灰机wiki 首选）抓取事实数据
- **本次交付**：方案文档（不写代码）

用户技术背景：前端/全栈经验 + 最熟悉 Java 栈。

---

## 一、整体架构

```
┌──────────────────┐       REST/JSON / SSE      ┌──────────────────────┐
│  Next.js 14 前端 │  ◄──────────────────────►  │  Spring Boot 3 后端  │
│  (SSG/ISR/SSR)   │                            │  (REST + AI 模块)    │
└──────────────────┘                            └──────────┬───────────┘
                                                            │
                                                 ┌──────────▼───────────┐
                                                 │   PostgreSQL         │
                                                 │   + pgvector (嵌入)  │
                                                 │   + FTS (全文检索)   │
                                                 └──────────┬───────────┘
                                                            │
                ┌──────────────────┐                       │
                │  Python 抓取脚本 │ ──► /data/seed/*.json ─► seed 入库 + 生成 embedding
                │  (独立子项目)    │
                └──────────────────┘
                                                            │
                                                            ▼
                                ┌────────────────────────────────────────┐
                                │  AI Provider（国内，可切换）             │
                                │  · 智谱 GLM-4-Plus（文本，主力）         │
                                │  · GLM-4V（多模态，图片识别）            │
                                │  · GLM embedding-3（向量，1024 维）      │
                                │  · 通义千问 Qwen / DeepSeek（降级备选） │
                                │  · 通义 OCR / 百度 OCR（专用 OCR）       │
                                └────────────────────────────────────────┘
```

**职责划分**：
- **前端**：UI、SEO、数据工具的客户端计算、AI 对话/上传交互
- **后端**：数据 CRUD、搜索、AI 编排（RAG 检索 + Prompt 组装 + Provider 调用 + 流式返回）
- **抓取**：Python 独立子项目，输出 JSON 入库；入库时同步生成 embedding
- **AI Provider**：通过抽象 `LlmClient` 接口屏蔽，YAML 切换

---

## 二、技术选型

### 前端
| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | **Next.js 14+ App Router** + TypeScript | SSG/ISR 保 SEO |
| UI | **Tailwind CSS** + **shadcn/ui** | 上手快、组件可改造 |
| 数据获取 | Server Components + TanStack Query | 列表筛选用 URL query 驱动 |
| 文章 | MDX（`next-mdx-remote`） | 攻略中可嵌入 React 组件 |
| AI 交互 | 流式用 `fetch` ReadableStream（不依赖 EventSource，POST 友好） | SSE 流式问答 |
| 部署 | Vercel 或国内云 | Next.js 原生支持 |

### 后端（Spring Boot）
| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | **Spring Boot 3.x**（Java 17 LTS） | 主流稳定 |
| 构建 | Maven | 稳、配置直观（偏好 Gradle 也可换） |
| Web | Spring MVC + **SseEmitter / WebFlux** | MVC 起步；AI 流式响应用 SSE |
| 持久层 | MyBatis-Plus（默认） | 国内主流；偏好 JPA 可换 |
| 数据库 | **PostgreSQL + pgvector** | 关系数据 + 向量检索 + FTS 三合一 |
| API 文档 | SpringDoc OpenAPI | 前后端联调便利 |
| 校验 | Hibernate Validator | 字段约束标准化 |
| 缓存 | Caffeine（本地）/ Redis（多实例） | 热点数据、AI 响应缓存 |
| HTTP 客户端 | **Spring 6 HTTP Interface** 或 OkHttp | 调用 LLM Provider API |
| 测试 | JUnit 5 + Testcontainers | 集成测试用真 PG |

### AI 栈
| 层 | 选择 | 理由 |
|---|---|---|
| 主力 LLM | **智谱 GLM-4-Plus / GLM-4-0520** | 已有账号；OpenAI 兼容 API；国内访问稳定 |
| 备选 LLM | 通义千问 Qwen-Max / DeepSeek-V3 | 多 Provider 降级保障；DeepSeek 价格极低 |
| 多模态 | **GLM-4V** | 图片识别精灵、技能面板 OCR |
| Embedding | **GLM embedding-3**（1024 维，可配置） | 中文友好、pgvector 直接存 |
| 向量检索 | **pgvector**（PostgreSQL 扩展） | 与主库统一，免运维额外服务 |
| OCR（专用） | 通义 OCR / 百度 OCR API | 高密度技能文本识别精度更高（可选） |
| 抽象层 | **Spring AI** + 自封装 `LlmClient` 接口 | OpenAI 兼容模式覆盖 GLM/DeepSeek/Qwen/Kimi；多 Provider 切换、降级、能力路由 |

> **MVP 暂不引入**：Spring Security、消息队列、链路追踪——社区/账号阶段再加。

---

## 三、数据模型

原有实体不变，**新增 AI 相关表**：

```
# —— 原有实体 ——
pet（精灵）         id, slug, name, description, rarity, base_stats(jsonb), obtain_methods[], source_url
skill（技能）       id, slug, name, category, power, accuracy, pp, effect_text
type（属性）        id, slug, name, icon, color
pet_type            精灵 ↔ 属性（多对多）
pet_skill           精灵 ↔ 技能（带学习等级/方式）
type_effectiveness  属性相克矩阵
evolution_chain     进化链（group_id, source_url）
evolution_stage     进化链阶段（chain_id, stage_no, pet_id, pet_name, types jsonb, head_key, illustration_key）
article（攻略）     MDX 文件起步；后期可入库

# —— AI 新增 ——
embedding（向量嵌入）
  id BIGSERIAL PK
  entity_type VARCHAR    -- pet / skill / article
  entity_id   BIGINT
  chunk_text  TEXT       -- 被嵌入的文本块（便于回看/调试）
  vector vector(1024)    -- GLM embedding-3 维度（可按 provider 调整）
  model VARCHAR
  created_at TIMESTAMP
  INDEX ON embedding USING ivfflat (vector vector_cosine_ops)

ai_chat_session（对话会话，可选）
  id, user_session_id, title, created_at

ai_chat_message（对话消息）
  id, session_id, role(user/assistant), content, refs jsonb, tokens_used, created_at
  -- refs: 回答引用了哪些精灵/技能/文章，便于「回答来源」展示

ai_generation_log（生成/补全日志，便于审计）
  id, scene(填充/简介/...), target_type, target_id, prompt_hash, model, tokens, status, created_at
```

**关键设计**：
- `slug` 全局唯一稳定，是详情页 URL 基石
- 属性相克单独建表，方便双向查询
- **embedding 表通用化**：用 `entity_type + entity_id` 复用一张表存所有内容的向量
- 向量索引用 `ivfflat`（pgvector 默认），数据量大再考虑 `hnsw`

---

## 四、抓取方案（Python 独立子项目）

### 4.1 数据源
- **首选（已实测确认）**：**BWIKI 哔哩哔哩 wiki** `https://wiki.biligame.com/rocom/` ——「洛克王国:手游」专属 wiki，HTTP 200 可达，robots.txt 允许抓取 wiki 内容页，S2 版本数据齐全（**671 只精灵**）。
  - **关键优势**：BWIKI 把全部游戏数据以 **Lua 数据模块**结构化发布，经 MediaWiki `api.php`（`action=parse&page=Module:PetData/*&prop=wikitext`）直接拉取，**无需 HTML 解析、无需反爬**：
    - `Module:PetData/Core`（671 精灵主属性，缩写键）`Index`（ID 索引）`SkillCatalog`（全技能）`Evolution`（进化链）`Handbook`（图鉴信息）
  - 模块头部带 key 缩写映射表（`_meta.key`），宠物 key 例：`at`=物攻 `df`=物防 `hp`=血量 `sa`=魔攻 `sd`=魔防 `se`=速度 `tp`=属性 `st`=种族值 `sg`=阶段 `evg`=进化组。
- ~~首选：灰机wiki~~（**已弃用**）：`rocokingdom.huijiwiki.com` 被 Cloudflare 人机验证封锁（robots.txt 与页面均返回 403 / JS 挑战），普通爬虫无法访问。
- 补充：官方网站/公告、TapTap/百度百科（交叉校验）
- **注意**：属性相克矩阵数据 BWIKI Lua 模块中不存在（仅有 18 个属性枚举），Phase 1 入库 18 个属性枚举 **并搭建好相克矩阵表结构**（`type_effectiveness`，V3 迁移）；相克倍率数据待人工校对权威来源后填充 `data/seed/type_effectiveness.json`。

### 4.2 合规
- ✅ 只抓事实数据（数值、属性、技能参数）
- ❌ 不抓原创攻略文本
- ⚠️ 立绘不下载到自家服务器；用占位符或外链，注明出处
- 遵守 `robots.txt`、QPS ≤ 1、带 UA、每条记录留 `source_url`

### 4.3 流程
```
scraper/                          # Python 独立子项目（项目根目录下）
  src/
    api.py            # MediaWiki API 封装：fetch_module_wikitext(name) → str；QPS≤1、UA、重试
    lua_parser.py     # ★ 核心：递归下降解析 Lua 表（无引号 key/嵌套/数组/布尔/尾逗号），纯标准库
    fetcher.py        # 拉 5 个 Module:PetData/* → 结构化 dict
    transformers.py   # Lua dict → seed JSON 字段映射/清洗/校验
    exporters.py      # 写出 data/seed/*.json（含 source_url/scraped_at/counts）
  main.py             # 入口（--dry-run / --only=pets）
  tests/              # Lua 解析回归（用 Core 真实片段）
```
- 输出 `data/seed/{types,pets,skills,evolutions}.json`（项目根目录下 `data/seed/`）
- Spring Boot 的 `SeedRunner`（`CommandLineRunner`，`@Profile("seed")` 显式激活）导入数据库
- **入库后触发 embedding 批量生成**（异步任务，避免阻塞）—— Phase 5 才启用
- 增量更新：内容 hash + `updated_at`
- 校验失败 → `quarantine.json` 人工 review

> Java 也可抓取（Jsoup），但 Python 生态更好；保持抓取独立于后端语言。

---

## 五、项目结构

### 后端 `spiritdex-api/`
```
src/main/java/com/spiritdex/api/
├── SpiritDexApplication.java
├── config/            # WebConfig, CorsConfig, MyBatisPlusConfig, AiConfig
├── controller/
│   ├── PetController, SkillController, TypeController, ArticleController
│   └── ai/ChatController, RecommendController, IdentifyController
├── service/           # 业务逻辑（CRUD + 搜索）
├── ai/                # ★ AI 模块（新增）
│   ├── client/        # 业务侧统一接口：LlmClient / EmbeddingClient / VisionClient
│   ├── provider/      # Provider 实现：OpenAiCompatibleClient（覆盖 GLM/DeepSeek/Qwen/Kimi）+ GlmNativeClient（GLM-4V 等专用）
│   ├── router/        # CapabilityRouter（按能力路由）+ FallbackChain（降级链）
│   ├── embedding/     # EmbeddingService（批量/单条生成）
│   ├── rag/           # Retriever（向量+FTS 混合检索）+ Generator
│   ├── recommend/     # 阵容/培养推荐逻辑
│   ├── generation/    # 简介生成、字段补全
│   ├── ocr/           # 图片识别（GLM-4V + 专用 OCR 降级）
│   ├── prompt/        # PromptTemplateManager（YAML/MD 管理）
│   ├── config/        # AiProperties（@ConfigurationProperties 多 provider 配置）
│   └── moderation/    # 输入/输出合规过滤（可选）
├── mapper/            # MyBatis-Plus Mapper
├── entity/            # 数据库实体
├── dto/               # 请求/响应 DTO
├── exception/         # @RestControllerAdvice 全局异常
├── seed/              # SeedRunner（CommandLineRunner）
└── util/
src/main/resources/
├── application.yml
├── application-{dev,prod}.yml
├── prompts/           # ★ Prompt 模板（YAML/MD）
│   ├── rag-chat.yml
│   ├── pet-summary.yml
│   └── team-recommend.yml
├── mapper/*.xml
└── db/migration/      # Flyway V1__init.sql, V2__pgvector.sql, V3__ai_tables.sql
```

### 前端 `spiritdex-web/`
```
app/
├── pets/{page,[slug]/page}.tsx
├── skills/
├── types/page.tsx
├── articles/[slug]/page.tsx
├── tools/{damage-calculator,team-builder}/page.tsx
├── ai/
│   ├── chat/page.tsx           # 智能问答（流式）
│   ├── identify/page.tsx       # 上传截图识别精灵
│   └── recommend/page.tsx      # 阵容推荐
components/{pet,type,article,ai,ui}/
lib/{api.ts, seo.ts, sse.ts, utils.ts}
```

### 抓取 `scraper/`（独立 Python 子项目）
### 数据 `data/seed/*.json`（抓取产物）

---

## 六、API 设计

### 基础数据 API
```
GET  /api/pets                ?type=&rarity=&q=&page=&size=
GET  /api/pets/{slug}         # 详情（含技能、进化、相克摘要）
GET  /api/skills              ?type=&q=
GET  /api/skills/{slug}
GET  /api/types
GET  /api/types/matrix        # 相克矩阵
GET  /api/articles/{slug}
GET  /api/calc/damage         ?atk=&skillSlug=&defTypeA=&defTypeB=
```

### AI API（新增）
```
POST /api/ai/chat             # 流式 SSE 返回；body: {session_id?, question}
POST /api/ai/recommend        # body: {owned_pets: [slug], goal: 推图/PVP/...}
POST /api/ai/identify         # multipart: 图片; 返回候选精灵 + 置信度
POST /api/ai/summarize/{slug} # 触发精灵简介（重新）生成（管理员）
POST /api/ai/embeddings/rebuild  # 重建向量索引（管理员，手动触发）
```

**约定**：
- 统一响应包装 `{code, message, data}`，AI 流式除外（SSE）
- 分页 `?page=&size=`，返回 `{list, total, page, size}`
- AI 端点单独的限流与成本控制（见下）
- 错误用标准 HTTP 状态码 + 全局异常处理器

---

## 七、AI 集成详细设计

### 7.1 智能问答（RAG）
**流程**：
```
用户问题
  ↓
1. 问题改写（多轮对话时用 LLM 把「它呢」改写为完整问题）
  ↓
2. 混合检索：pgvector 向量召回 + Postgres FTS 关键词召回，加权融合 top-K
  ↓
3. Prompt 组装：系统人设 + 检索片段 + 用户问题 + 输出要求
  ↓
4. GLM-4-Plus 流式生成 → SSE 推给前端
  ↓
5. 解析回答中的实体引用，存 ai_chat_message.refs，前端渲染「来源」标签
```

**人设要点**：洛克王国手游攻略助手；只用提供的事实数据；不确定时如实说；中文回答。

### 7.2 阵容/培养推荐
- 输入：用户已有精灵列表 + 目标场景（推图/PvP/特定副本）
- 后端组装完整数据上下文（精灵属性、技能、相克关系），交给 LLM 推理
- 输出：推荐阵容（5只）+ 理由 + 培养优先级
- **可考虑**：先用规则引擎做粗筛（属性互补），再用 LLM 做精排与解释，省 token

### 7.3 内容生成 / 补全
- **场景**：抓取后某些精灵 `description` 字段空缺 → 后台触发 LLM 生成
- **流程**：基于该精灵的属性/技能/数值数据，按 prompt 模板生成简介
- **重要**：生成内容必须标记 `ai_generated=true`，并允许人工编辑覆盖
- **审计**：`ai_generation_log` 记录每次调用，便于回查

### 7.4 图片识别 / OCR
- **精灵识别**：用户上传截图 → GLM-4V 描述「这是什么精灵」 → 模糊匹配精灵库 → 返回候选 + 跳转链接
- **技能面板 OCR**：GLM-4V 直接读图，或调用专用 OCR API 提高密度文本精度
- **限制**：图片大小、上传频率、文件类型白名单

### 7.5 成本与风控
- **限流**：每 IP / 会话的 AI 调用频率上限（如 30 次/小时）
- **Token 上限**：单次请求 max_tokens 上限、Prompt 长度截断
- **缓存**：相同问题的回答短时缓存（hash(question+context)）
- **降级**：主模型（GLM）不可用时自动切 Qwen 或 DeepSeek；多次失败返回兜底文案
- **审计**：所有 AI 调用入 `ai_generation_log`，便于成本分析与异常排查
- **合规**：调用国内模型通常需要 API 实名备案（按 provider 要求执行）

### 7.6 Prompt 管理
- 集中放 `resources/prompts/*.yml`，含模板、变量、版本号
- 修改 prompt 不需要改代码、便于 A/B
- 模板渲染：简单的 `{{var}}` 占位符即可，无需重型模板引擎

### 7.7 多 Provider 接入与切换设计

**目标**：保留切换/扩展 AI Provider 的能力，避免被单一厂商锁定；新增 provider 零业务代码改动。

**核心策略：基于 OpenAI 兼容协议**

国内主流 provider 都提供 OpenAI 兼容端点，一套客户端 + 配置切换即可覆盖：

| Provider | 兼容端点 | 备注 |
|---|---|---|
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/` | 主力 |
| DeepSeek | `https://api.deepseek.com/v1` | 降级备选 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 降级备选 |
| Moonshot Kimi | `https://api.moonshot.cn/v1` | 长上下文场景 |
| OpenAI / Azure | 原生 | 海外场景 |

**框架选型**：用 **Spring AI** 作为抽象层底座——官方维护、与 Spring Boot 3 原生集成、支持流式/embedding/function calling，通过 OpenAI 兼容配置即可接入上面所有 provider。

**抽象层结构**：
```
ai/client/      LlmClient / EmbeddingClient / VisionClient   ← 业务侧调用的统一接口
ai/provider/    OpenAiCompatibleClient（通用）+ GlmNativeClient（GLM-4V 等专用）
ai/router/      CapabilityRouter（按能力路由）+ FallbackChain（降级链）
ai/config/      AiProperties（@ConfigurationProperties 加载多 provider 配置）
```

**配置驱动**（`application.yml` 示例）：
```yaml
ai:
  capabilities:                    # 按能力绑定 provider + 降级链
    chat:
      primary: glm
      fallback: [deepseek, qwen]
    embedding:
      primary: glm                 # 切换 embedding provider 需重建索引
      fallback: []
    vision:
      primary: glm-vision          # GLM-4V
      fallback: [qwen-vl]
  providers:                       # 各 provider 连接配置
    glm:
      base-url: https://open.bigmodel.cn/api/paas/v4
      api-key: ${GLM_API_KEY}
      chat-model: glm-4-plus
      embedding-model: embedding-3
      embedding-dim: 1024
    glm-vision:
      base-url: https://open.bigmodel.cn/api/paas/v4
      api-key: ${GLM_API_KEY}
      vision-model: glm-4v
    deepseek:
      base-url: https://api.deepseek.com/v1
      api-key: ${DEEPSEEK_API_KEY}
      chat-model: deepseek-chat
    qwen:
      base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
      api-key: ${QWEN_API_KEY}
      chat-model: qwen-max
      embedding-model: text-embedding-v3
      embedding-dim: 1024
    qwen-vl:
      base-url: https://dashscope.aliyuncs.com/compatible-mode/v1
      api-key: ${QWEN_API_KEY}
      vision-model: qwen-vl-max
```

**能力路由**：不同任务可绑定不同 provider，按成本/质量灵活组合：
- 智能问答 / 推荐 → GLM-4-Plus（流畅，中文好）
- 大批量内容补全 → DeepSeek（价格极低）
- 图片识别 → GLM-4V（主）/ Qwen-VL（降级）
- Embedding → GLM embedding-3（保持索引一致性）

**降级链**：primary 失败（超时 / 限流 / 服务异常）→ 按 `fallback` 顺序尝试 → 全部失败返回兜底文案 + 告警。

**关键约束（必须知道）**：
- **Embedding 切换需重建索引**：不同 provider 的向量空间不兼容，切换 embedding provider 必须**重建整个 `embedding` 表**；建议 embedding 不设 fallback、固定单一 provider
- **Function calling 兼容性**：GLM / DeepSeek / Qwen 都支持 OpenAI function calling 格式，但行为细节有差异；高级用法切换 provider 时需测试
- **流式响应**：所有兼容 provider 都支持 SSE，Spring AI 统一封装，业务无感
- **多模态差异最大**：GLM-4V / Qwen-VL / DeepSeek-VL 接口不完全一致，专用 client 单独实现

**新增 provider 步骤**：
1. 在 `application.yml` 的 `providers` 下加一段连接配置
2. 若是 OpenAI 兼容（大多数情况）：零代码改动，直接可用
3. 若有特殊能力（如专用多模态）：实现一个 `XxxNativeClient`，注入 `CapabilityRouter`
4. 在 `capabilities` 中按需引用

**MVP 实施建议**：先用 GLM 单 provider 跑通完整流程，但 `LlmClient` 接口 + 配置结构提前留好——后续加 provider 完全零业务代码改动。

---

## 八、关键页面交互

### 精灵图鉴（核心）
- 列表：网格卡片 + 多维筛选（属性/稀有度/获取方式）+ 搜索
- 筛选服务端化：URL query 驱动，可分享、可 SEO
- 详情：属性雷达图、技能池（按学习方式分组）、进化链可视化、属性相克摘要、**「问 AI」按钮跳聊天预填上下文**

### 属性相克表
- 经典矩阵 + 单属性查询「打谁 2x / 被谁克制」

### 数据工具
- 伤害计算器、阵容模拟
- **新增**：AI 阵容推荐（输入已有精灵，AI 推荐）

### 攻略文章
- MDX 渲染，支持 `<PetCard/>`、`<SkillBadge/>` 组件

### AI 入口
- `/ai/chat`：全站浮窗 + 独立页，流式问答，引用来源可点击跳转
- `/ai/identify`：拖拽上传截图，秒级识别
- `/ai/recommend`：勾选已有精灵，生成阵容

---

## 九、SEO 与性能

- **静态化**：精灵/技能详情页 `generateStaticParams` + ISR（24h）
- **元数据**：`generateMetadata` + `application/ld+json` schema
- **sitemap**：`app/sitemap.ts` 自动生成
- **后端缓存**：相克矩阵、热点详情用 Caffeine
- **图片**：`next/image` + 远程图片域名白名单
- **AI 路径不参与 SEO**：`/ai/*` 页面允许 noindex，避免 AI 内容污染搜索结果质量

---

## 十、分期路线

| 阶段 | 范围 | 目标 |
|---|---|---|
| **Phase 0** | 后端 + 前端脚手架；打通 `/api/pets` → 前端展示 | 地基通畅 |
| **Phase 1** | 抓取脚本（属性/精灵/技能/进化链）；SeedRunner 入库；相克矩阵表结构搭建（数据待填充） | 数据就绪 |
| **Phase 2** | 精灵图鉴（列表+筛选+详情）+ 属性相克表 | **首个可上线版本** |
| **Phase 3** | 技能库 + MDX 攻略文章 | 内容扩充 |
| **Phase 4** | 数据工具（伤害计算、阵容模拟） | 工具化 |
| **Phase 5** | **AI 集成**：① pgvector + Embedding 入库 ② RAG 智能问答（SSE 流式） ③ 内容补全（后台） | 智能化 |
| **Phase 6** | AI 阵容/培养推荐 + 图片识别精灵 | AI 工具矩阵 |
| **Phase 7（远期）** | Spring Security 账号、收藏、评论、后台 CMS | 社区化 |

> AI 放在数据基础完整之后，因为没有完整的精灵/技能数据，RAG 与推荐都做不好。

---

## 十一、部署

**已确认部署架构**（2026-07-10）：

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | **Vercel** | Next.js 原生支持，免费档够用；全球 CDN |
| 后端 | **国内云**（阿里云/腾讯云 ECS 或轻量应用服务器） | Jar + systemd；前置 Nginx 反代 + HTTPS |
| 数据库 | **国内云 RDS PostgreSQL** | **必须确认支持 pgvector 扩展**；不支持则自建 PG 16+ |
| AI Provider | **智谱 GLM**（已有账号） | 国内访问稳定、OpenAI 兼容 API；备用 Qwen / DeepSeek |
| 域名 + HTTPS | 主域 + api 子域 | Let's Encrypt 或云商免费证书 |

### 域名与跨域策略

- 主域 `lingchong.example.com` → Vercel（前端）
- API 子域 `api.lingchong.example.com` → 国内云服务器（后端）
- 后端配置 **CORS** 允许前端域名；前端通过 Next.js `rewrites` 或直接 fetch 调 `api.*` 子域
- 国内云服务器需开放 80/443 端口；**域名解析到国内 IP 必须 ICP 备案**

### 国内访问 Vercel 的注意点

Vercel 在国内访问偶有波动；如主流量在国内且体验不佳，备选：
- 前端也迁到国内云，用 Nginx 托管 `next start`（与后端同域或独立子域）
- 或主域用国内 CDN（阿里云 DCDN / 腾讯云 EdgeOne）回源到 Vercel

### AI Provider 备案

智谱 GLM 需账号实名认证（已完成账号准备即可调用）；备用 Qwen / DeepSeek 同样需实名；**上线前确认所有 Provider 实名状态**。

---

## 十二、风险与注意事项

1. **数据合规**：只抓事实、注明来源、不搬运立绘和原创攻略；加「数据来源声明」页
2. **数据时效**：手游版本频繁更新，GitHub Actions 周更跑抓取
3. **数据质量**：抓取来源偶有错误，留 quarantine 人工 review
4. **国内访问**：Vercel 国内波动；主流量在国内需评估国内云
5. **版权标识**：站内显著位置标注「非官方，数据仅供参考」
6. **前后端联调**：开发期 Next.js `rewrites` 转发 `/api` 到本地 8080
7. **AI 成本失控**：必须做限流 + token 上限 + 缓存；监控 `ai_generation_log`
8. **AI 内容合规**：国内模型已有内容审查，但仍建议加输出过滤；生成内容标注「AI 生成」
9. **AI 幻觉**：RAG 强制要求「只用提供的事实」，prompt 中明确禁止编造；回答附来源
10. **pgvector 可用性**：选 RDS 前确认是否支持该扩展，否则需自建 PG

---

## 十三、验证方式

- 后端：`mvn spring-boot:run` + Swagger UI 调通核心端点
- 前端：`pnpm dev`，访问 `/pets` 列表与筛选、`/pets/[slug]` 详情
- 抓取：`python main.py` → seed JSON → SeedRunner → DB 有数据
- AI 问答：`POST /api/ai/chat` 问「火系被什么克制」，验证回答引用了正确数据
- AI 识别：上传精灵截图，返回候选精灵 slug
- Lighthouse：首页与详情页 Performance ≥ 90、SEO ≥ 95
- AI 路径抽查：5 个 RAG 问答，确认引用来源可点击、无幻觉

---

## 十四、首推动作清单

1. 后端：`spring initializr` 选 Web + MyBatis-Plus + PostgreSQL + Flyway + Validation + Lombok，Java 17
2. 前端：`pnpm create next-app spiritdex-web --typescript --tailwind --app`
3. 最小联通：写 `GET /api/pets` 返 2 条假数据，前端拉到展示
4. 起 `scraper/`，先跑通属性 + 相克数据
5. 补完精灵抓取 → 入库 → 图鉴列表 + 详情页
6. **（AI 阶段准备）** Phase 0 时就在 `pom.xml` 预留 `ai/` 模块位置；Phase 2 上线后再启用 pgvector 和 LLM 客户端

---

## 十五、账号体系预案（Phase 7，当前不做）

> 本节为未来启动 Phase 7 时的设计预案，**MVP 阶段不实现**。提前记录关键约束，避免后续踩坑。

### 核心约束（必须先理解）

- 洛克王国手游玩家宠物/背包数据归腾讯/网易所有，**官方不开放第三方 API**
- QQ 互联 / 微信开放平台的 OAuth 流程**只能拿到 openid + 昵称 + 头像**，**拿不到任何游戏内数据**（精灵、练度、背包）
- 想做「我的精灵 → AI 推荐」，数据来源必须由用户主动提供，**不能依赖 OAuth 拉取游戏数据**

### 推荐架构

| 维度 | 方案 | 说明 |
|---|---|---|
| **账号主入口** | 手机号 / 邮箱本地账号 | 自主可控、无外部资质依赖 |
| **快捷登录**（可选） | QQ / 微信 OAuth | 仅替代注册流程；需企业主体 + 网站备案 + 平台资质审核 |
| **「我的精灵」数据来源** | ① 手动勾选（MVP 必做） | 图鉴页提供「加入我的收藏」按钮，用户勾选已拥有精灵 |
|  | ② 截图 OCR 识别（复用 Phase 6 AI 能力） | 用户上传背包/详情页截图，AI 自动识别并填充，体验最佳 |
|  | ❌ OAuth 拉取游戏数据 | 不可行，别投入资源 |
| **AI 推荐** | 基于用户「已拥有」清单 + Phase 6 推荐逻辑 | 输出阵容 / 培养优先级建议 |

### 为什么这样设计

- 自主可控：账号体系不依赖任何外部资质，可在 MVP 后随时启动
- 复用 AI 能力：截图识别与 Phase 6 的图片识别共用一套 Qwen-VL 管线
- OAuth 仅作锦上添花：有资质再上，没有也不阻塞核心流程

### 启动 Phase 7 的前置条件

- Spring Security + JWT 接入
- 手机号验证码（短信服务商选型）
- 用户协议、隐私政策（合规要求）
- 若要加 OAuth：企业主体注册、网站 ICP 备案、QQ 互联 / 微信开放平台资质审核通过

---

## 决策记录

**已确认（2026-07-10）**：
- 持久层：**MyBatis-Plus**
- 构建工具：**Maven**
- 部署目标：**前端 Vercel + 后端国内云（阿里云/腾讯云）+ RDS PostgreSQL（pgvector）**
- AI 主力模型：**智谱 GLM-4-Plus**（用户已有账号）；降级备选 通义千问 Qwen / DeepSeek

**Phase 1 追加决策（2026-07-10，实测后调整）**：
- **数据源改判 BWIKI**：实测灰机wiki（`rocokingdom.huijiwiki.com`）已被 Cloudflare 封锁不可爬；改用 **BWIKI（`wiki.biligame.com/rocom`）**，经 MediaWiki API 拉 Lua 数据模块（`Module:PetData/*`），无 HTML 解析、无反爬。共 671 只精灵。
- **属性相克矩阵表结构搭建（数据待填充）**：BWIKI Lua 模块中无相克数据（仅 18 个属性枚举），Phase 1 入库 18 个属性枚举 + 建好 `type_effectiveness` 表结构（V3 迁移 + 实体 + Mapper + SeedRunner 读取逻辑）；相克倍率数据待人工校对权威来源后填入 `data/seed/type_effectiveness.json` 跑 seed 即可。
- **Slug 规则**：精灵 `pet-{dex_no:04d}`、技能 `skill-{id:04d}`（稳定、唯一、与 ID 对齐）。
- **SeedRunner 显式激活**：`@Profile("seed")`，`--spring.profiles.active=seed` 才触发，避免正常启动重跑全量入库。

**所有架构决策已敲定，可以开始动工。**
