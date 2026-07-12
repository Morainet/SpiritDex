# 灵宠档案（SpiritDex）部署指南

> 本文档覆盖前端（Vercel）+ 后端（国内云）+ 数据库（RDS PostgreSQL）的完整部署流程。
> 代码侧已就绪，按本文配置云资源即可上线。

## 架构

```
用户 → Vercel（前端 Next.js，全球 CDN）
                ↓ fetch
         api.你的域名 → Nginx（HTTPS 反代）→ 后端 Spring Boot（Docker，国内云 ECS）
                                    ↓                        ↓
                        本地 Embedding 服务（Python，512维）   GLM chat（智谱，流式回答）
                                    ↓
                        RDS PostgreSQL 16（需支持 pgvector）
```

> **Embedding 用本地 sentence-transformers**（免费），Chat 用智谱 GLM（免费 flash 档）。
> 两者独立，互不影响。详见「embedding 服务」一节。

## 一、数据库（RDS PostgreSQL）

### 1.1 创建实例
- 选 **PostgreSQL 16+**（必须支持 pgvector 扩展）
- 阿里云 RDS / 腾讯云 PostgreSQL 均可，确认 pgvector 可用（PG 16 自带或可装）
- 创建数据库 `spiritdex`，账号 `spiritdex` / 强密码
- 白名单：放行后端 ECS 内网 IP

### 1.2 验证 pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname='vector';  -- 应返回版本号
```

### 1.3 初始化数据
Flyway 会在后端首次启动时自动执行全部迁移（V1~V8）建表。然后跑数据导入：

```bash
# 前置：先启动本地 embedding 服务（见下一节「embedding 服务」）
cd embedding-service && python server.py &  # 监听 :8710

# 1. 基础数据（精灵/技能/相克/文章）
export SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-host>:5432/spiritdex
export SPRING_DATASOURCE_USERNAME=spiritdex
export SPRING_DATASOURCE_PASSWORD=<password>
./mvnw spring-boot:run -Dspring-boot.run.profiles=seed

# 2. 文字 embedding（本地免费，无需 GLM 余额）
./mvnw spring-boot:run -Dspring-boot.run.profiles=rebuild-text

# 3. 可选：视觉向量（图片识别，需 GLM-4V，受 BWIKI 限流影响）
export GLM_API_KEY=<your-key>
./mvnw spring-boot:run -Dspring-boot.run.profiles=vision-seed
```

## 二、Embedding 服务（本地，免费）

AI 问答的向量检索用**本地 sentence-transformers**（BAAI/bge-small-zh-v1.5，512 维），
完全免费、不依赖任何 API key，替代付费的智谱 embedding-3。

```bash
cd embedding-service
pip install sentence-transformers fastapi uvicorn
python server.py   # 监听 http://localhost:8710
```

- 后端通过 `SPIRITDEX_AI_LOCAL_EMBEDDING_URL`（默认 localhost:8710）调用
- 首次启动自动下载模型（~100MB），之后常驻内存
- 生产部署：和后端同机跑（systemd 守护），或容器化

```ini
# /etc/systemd/system/spiritdex-embedding.service
[Unit]
Description=SpiritDex Embedding Service
[Service]
WorkingDirectory=/path/to/embedding-service
ExecStart=/usr/bin/python3 server.py
Restart=always
[Install]
WantedBy=multi-user.target
```

## 二、后端（国内云 ECS / 轻量服务器）

### 2.1 构建 Docker 镜像
```bash
cd spiritdex-api
docker build -t spiritdex-api .
```

### 2.2 运行
```bash
docker run -d --name spiritdex-api --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-host>:5432/spiritdex \
  -e SPRING_DATASOURCE_USERNAME=spiritdex \
  -e SPRING_DATASOURCE_PASSWORD=<password> \
  -e GLM_API_KEY=<your-glm-key> \
  -e SPIRITDEX_CORS_ORIGINS=https://你的域名 \
  spiritdex-api
```
- `127.0.0.1:8080`：只监听本地，由 Nginx 反代对外（不直接暴露）
- 环境变量说明见下表

### 2.3 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `SPRING_DATASOURCE_URL` | 是 | RDS 连接串，含 `?stringtype=unspecified` |
| `SPRING_DATASOURCE_USERNAME` | 是 | DB 用户名 |
| `SPRING_DATASOURCE_PASSWORD` | 是 | DB 密码 |
| `GLM_API_KEY` | AI 功能需要 | 智谱 GLM key（无则 AI 自动降级） |
| `SPIRITDEX_CORS_ORIGINS` | 是 | 前端域名，逗号分隔 |

### 2.4 Nginx 反代 + HTTPS
```nginx
server {
    listen 443 ssl http2;
    server_name api.你的域名;
    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # SSE 流式必须关缓冲（AI 问答/推荐）
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;           # ★ SSE 流式必须
        proxy_read_timeout 60s;
    }
}
```
- HTTPS 证书：Let's Encrypt（免费）或云商免费证书
- 域名解析到国内 IP **必须 ICP 备案**

## 三、前端（Vercel）

### 3.1 导入项目
- Vercel → New Project → 导入 spiritdex-web 仓库
- Framework Preset: Next.js（自动识别）

### 3.2 环境变量（Vercel 控制台 Settings → Environment Variables）
| 变量 | 值 |
|---|---|
| `BACKEND_URL` | `https://api.你的域名`（后端公网 HTTPS 地址） |

### 3.3 图片域名
`next.config.ts` 已配 `wiki.biligame.com` + `patchwiki.biligame.com` 白名单，无需额外设置。

### 3.4 部署
push 到 main 分支即自动部署。Vercel 自动 HTTPS + 全球 CDN。

> 国内访问 Vercel 偶有波动，如主流量在国内且体验不佳，前端可改部署到国内云（Nginx 托管 `next start`）。

## 四、域名规划

| 域名 | 指向 | 用途 |
|---|---|---|
| `你的域名`（或 www） | Vercel | 前端 |
| `api.你的域名` | 国内云 ECS | 后端 API |

## 五、部署后验证清单

- [ ] `https://你的域名` 首页加载正常
- [ ] `/pets` 精灵图鉴列表有数据（671只）
- [ ] `/pets/pet-0001` 喵喵详情含种族值/进化链
- [ ] `/types/matrix` 相克表染色正常
- [ ] `/ai/chat` 提问能流式回答（需 GLM key）
- [ ] 后端 `https://api.你的域名/api/types` 返回 JSON
- [ ] CORS：前端能跨域调后端（无控制台报错）
- [ ] SSE：AI 问答流式（非一次性返回）

## 六、合规
- 域名解析国内 IP → **ICP 备案必须**
- AI Provider（智谱）→ 实名认证（已完成账号即可）
- 站内标注「非官方，数据仅供参考」（首页 footer 已有）
- 数据来源声明（BWIKI）
