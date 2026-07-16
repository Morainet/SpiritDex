# 灵宠档案 · SpiritDex

> 数据驱动的「洛克王国手游」攻略站 —— 精灵图鉴 + 属性工具 + AI 智能助手。

非官方、数据仅供参考。游戏数据来自 [BWIKI 洛克王国:手游 WIKI](https://wiki.biligame.com/rocom/)（`wiki.biligame.com/rocom`），仅抓取事实数值，不搬运原创攻略与立绘。

---

## ✨ 功能特性

- **精灵图鉴** —— 671 只精灵全收录，含种族值雷达图、进化链可视化、技能池、属性相克摘要
- **技能库** —— 737 个技能的效果、属性、威力参数检索
- **属性相克表** —— 18 属性相克矩阵，支持单属性「打谁 / 被谁克制」查询
- **数据工具** —— 伤害计算器、阵容模拟（属性覆盖与弱点分析）
- **攻略文章** —— 新手指南、进阶技巧、活动攻略（Markdown 渲染）
- **AI 智能问答** —— 基于精灵数据的 RAG 问答助手，SSE 流式回答，引用来源可点击跳转
- **AI 阵容推荐** —— 输入已有精灵，AI 推荐最佳阵容与培养优先级
- **AI 图片识别** —— 上传精灵截图，AI 识别候选精灵并返回置信度

---

## 🏗️ 整体架构

前后端分离的多模块单体仓库（monorepo）：

```
┌──────────────────┐       REST/JSON · SSE       ┌──────────────────────┐
│  Next.js 前端    │  ◄────────────────────────► │  Spring Boot 后端    │
│  (SSG/ISR/SSR)   │                             │  (REST + AI 模块)    │
└──────────────────┘                             └──────────┬───────────┘
                                                            │
                                                 ┌──────────▼───────────┐
                                                 │  PostgreSQL 16       │
                                                 │  + pgvector（向量）  │
                                                 │  + FTS（全文检索）   │
                                                 └──────────┬───────────┘
                                                            │
┌──────────────────┐                                       │
│  Python 抓取脚本 │ ──► data/seed/*.json ──► SeedRunner 入库 + 生成 embedding
│  (独立子项目)    │                                       │
└──────────────────┘                                       ▼
┌──────────────────┐                          ┌────────────────────────┐
│  Embedding 服务  │ ◄── 本地向量（免费）     │  智谱 GLM（chat/vision）│
│  sentence-trans. │                          │  OpenAI 兼容，可降级    │
└──────────────────┘                          └────────────────────────┘
```

**技术栈一览：**

| 层 | 选型 |
|---|---|
| 前端 | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui 风格组件 |
| 后端 | Spring Boot 3.5 · Java 17 · Maven · MyBatis-Plus · Flyway · SpringDoc OpenAPI |
| 数据库 | PostgreSQL 16+ · pgvector · 全文检索（FTS） |
| AI | Spring AI 1.0（OpenAI 兼容协议接智谱 GLM）· 本地 sentence-transformers（BAAI/bge-small-zh-v1.5，512 维） |
| 抓取 | Python 3 · requests · 纯标准库 Lua 表解析器 |

---

## 📁 仓库结构

```
SpiritDex/
├── scraper/             # 🐍 Python 抓取脚本（独立子项目）
│   ├── src/             #   api / lua_parser / fetcher / transformers / exporters
│   └── tests/           #   Lua 解析回归（含 BWIKI 真实数据 fixtures）
├── data/seed/           # 📦 抓取产物 JSON（671 精灵 / 737 技能 / 进化链 / 相克矩阵…）
├── db/                  # 🗄️ 数据库 dump（spiritdex_dump.sql）
├── spiritdex-api/       # ☕ Spring Boot 后端
│   └── src/main/java/com/spiritdex/api/
│       ├── controller/  #   Pet/Skill/Type/Article + Ai/{Chat,Identify,Recommend}
│       ├── ai/          #   ★ AI 模块（ChatService / IdentifyService / RecommendService / Retriever / EmbeddingService）
│       ├── service/     #   业务逻辑
│       ├── entity/      #   数据库实体
│       ├── mapper/      #   MyBatis-Plus Mapper
│       ├── dto/         #   请求/响应 DTO
│       └── seed/        #   SeedRunner（CommandLineRunner，显式 profile 激活）
├── embedding-service/   # 🐍 本地 Embedding 服务（FastAPI，:8710，免费）
├── spiritdex-web/       # ⚛️ Next.js 前端
│   ├── app/             #   pets / skills / types / articles / tools / ai/*
│   ├── components/      #   PetCard / StatsRadar / EvolutionChainView / ChatClient…
│   └── lib/             #   api / type-effectiveness / type-colors / ai-chat
└── doc/                 # 📚 实施方案与部署指南
    ├── implementation-plan.md
    └── deployment.md
```

---

## 🚀 快速开始

### 前置依赖

- **Java 17** + **Maven 3.9+**（或使用仓库自带 `mvnw`）
- **Node.js 20+** + **pnpm**
- **PostgreSQL 16+**（需安装 `pgvector` 扩展）
- **Python 3.10+**

### 1. 准备数据库

```bash
createdb spiritdex
psql -d spiritdex -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. 启动后端（spiritdex-api）

```bash
cd spiritdex-api
./mvnw spring-boot:run
# 默认连接 localhost:5432/spiritdex，账号 spiritdex/spiritdex
# Flyway 首次启动自动执行 V1~V8 迁移建表
```

### 3. 导入种子数据

```bash
# 先启动本地 Embedding 服务（AI 问答向量检索用，免费）
cd ../embedding-service && pip install -r requirements.txt && python server.py &  # :8710

# 回到后端，显式激活 seed profile 导入 data/seed/*.json
cd ../spiritdex-api
./mvnw spring-boot:run -Dspring-boot.run.profiles=seed

# 可选：生成文字 embedding（本地免费）/ 视觉向量（需 GLM_API_KEY）
./mvnw spring-boot:run -Dspring-boot.run.profiles=rebuild-text
GLM_API_KEY=<your-key> ./mvnw spring-boot:run -Dspring-boot.run.profiles=vision-seed
```

### 4. 启动前端（spiritdex-web）

```bash
cd ../spiritdex-web
pnpm install
BACKEND_URL=http://localhost:8080 pnpm dev
# 访问 http://localhost:3000
```

### 5.（可选）重新抓取数据

```bash
cd scraper
pip install -r requirements.txt
python main.py            # 实时抓取（联网，QPS≤1）
python main.py --offline  # 离线模式，用 tests/fixtures/ 缓存
```

---

## 🔑 关键环境变量

| 变量 | 所属模块 | 必填 | 说明 |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | 后端 | 是 | PostgreSQL 连接串，需含 `?stringtype=unspecified` |
| `SPRING_DATASOURCE_USERNAME` | 后端 | 是 | DB 用户名 |
| `SPRING_DATASOURCE_PASSWORD` | 后端 | 是 | DB 密码 |
| `GLM_API_KEY` | 后端 | AI 功能需要 | 智谱 GLM key；缺省时 AI 自动降级，不阻塞启动 |
| `SPIRITDEX_CORS_ORIGINS` | 后端 | 生产必填 | 允许的前端域名，逗号分隔 |
| `SPIRITDEX_AI_LOCAL_EMBEDDING_URL` | 后端 | 否 | 本地 Embedding 服务地址（默认 `localhost:8710`） |
| `BACKEND_URL` | 前端 | 是 | 后端公网/本地地址，如 `https://api.你的域名` |

---

## 🌐 API 一览

### 基础数据

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/pets` | 精灵列表，支持 `?type=&rarity=&q=&page=&size=` 筛选 |
| GET | `/api/pets/{slug}` | 精灵详情（含技能、进化、相克摘要） |
| GET | `/api/skills` | 技能列表 |
| GET | `/api/skills/{slug}` | 技能详情 |
| GET | `/api/types` | 属性列表 |
| GET | `/api/types/matrix` | 属性相克矩阵 |
| GET | `/api/articles/{slug}` | 攻略文章 |

### AI 能力

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/ai/chat` | RAG 智能问答（**SSE 流式**） |
| POST | `/api/ai/recommend` | 阵容/培养推荐 |
| POST | `/api/ai/identify` | 图片识别精灵（multipart 上传） |

> 统一响应包装 `{code, message, data}`；AI 流式端点除外。API 文档：后端启动后访问 `/swagger-ui.html`。

---

## 📊 数据来源与合规

- **数据源**：[BWIKI 洛克王国:手游 WIKI](https://wiki.biligame.com/rocom/)。BWIKI 将全部游戏数据以 Lua 数据模块结构化发布，抓取脚本经 MediaWiki `api.php` 拉取，无需 HTML 解析、无需反爬。
- **合规原则**：
  - 只抓事实数据（数值、属性、技能参数），每条记录带 `source_url`
  - 不搬运原创攻略文本，不下载立绘到自家服务器
  - 遵守 `robots.txt`，QPS ≤ 1，自定义 UA
  - 站内显著位置标注「非官方，数据仅供参考」
- **已知限制**：属性相克倍率为人工校对后填入；完整技能池（native/stone/blood）仅存在于页面级 wikitext，当前 `pet_skills.json` 仅含特性技能。详见 `scraper/README.md`。

---

## 📈 分期路线

| 阶段 | 范围 | 状态 |
|---|---|---|
| Phase 0–1 | 脚手架 + 抓取脚本 + 数据入库（671 精灵） | ✅ |
| Phase 2 | 精灵图鉴（列表+筛选+详情）+ 属性相克表 | ✅ |
| Phase 3 | 技能库 + 攻略文章 | ✅ |
| Phase 4 | 数据工具（伤害计算、阵容模拟） | ✅ |
| Phase 5 | AI 集成：pgvector + Embedding + RAG 流式问答 | ✅ |
| Phase 6 | AI 阵容推荐 + 图片识别 | ✅ |
| Phase 7（远期） | Spring Security 账号、收藏、评论、后台 CMS | 📌 未启动 |

---

## 📚 文档

- **[实施方案](doc/implementation-plan.md)** —— 架构、数据模型、AI 集成、分期路线的完整设计文档
- **[部署指南（轻量服务器同机）](doc/deployment.md)** —— DB/后端/embedding 全装一台轻量服务器，省钱、适合 MVP
- **[部署指南（RDS + 云服务器分离）](doc/deployment-rds.md)** —— 云托管 RDS + ECS 正式生产架构，自动备份/高可用
- 各子模块 README：[scraper](scraper/README.md) · [embedding-service](embedding-service/README.md) · [spiritdex-web](spiritdex-web/README.md)

---

## ⚠️ 声明

本项目为非官方、非商业性质的游戏数据参考工具，仅供学习交流使用。「洛克王国」及相关商标版权归原权利人所有。如有侵权请联系删除。
