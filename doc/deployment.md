# 灵宠档案（SpiritDex）部署指南

> 本文档覆盖前端（Vercel）+ 后端 + 数据库（自建 PostgreSQL）的完整部署流程，
> 全部跑在一台国内轻量应用服务器上。代码侧已就绪，按本文配置即可上线。

## 架构

```
用户 → Vercel（前端 Next.js，全球 CDN）
                ↓ fetch
         api.你的域名 → Nginx（HTTPS 反代）→ 后端 Spring Boot（Docker，轻量服务器）
                                    ↓                        ↓
                        本地 Embedding 服务（Python，512维）   GLM chat（智谱，流式回答）
                                    ↓
                        PostgreSQL 16 + pgvector（同机自建，本地 socket，零延迟）
```

> **Embedding 用本地 sentence-transformers**（免费），Chat 用智谱 GLM（免费 flash 档）。
> 两者独立，互不影响。详见「embedding 服务」一节。
>
> **数据库自建而非 RDS/托管**：项目数据量约 150MB，业务数据（AI 文章、未来 Phase 7
> 的用户/收藏）需零延迟、零迁移风险承载，自建 PG 同机部署最省成本也最稳。备份用
> `pg_dump` cron + 对象存储（详见 1.5）。

### 服务器选型

| 组件 | 选型 | 说明 |
|---|---|---|
| 前端 | Vercel 免费档 | 全球 CDN + 自动 HTTPS，push 即部署 |
| 后端 + DB + embedding | **国内轻量应用服务器** | 三者同机，2 核 4G 起步 |
| 域名 | 国内节点 + ICP 备案 | 买服务器同时启动备案（7-20 工作日） |

**为什么是轻量服务器而非云服务器 ECS**：Docker/systemd/Nginx/备案两者都支持，轻量
套餐价更低（2C4G ≈ 60-100 元/月 vs ECS 150-250）、带宽包月可控、自带面板上手快。
本项目无 VPC 内网需求（DB 同机走 localhost），ECS 的优势用不上。**务必先备案再上线**，
国内 IP 解析域名必须 ICP 备案，否则 80/443 会被拦截。

## 一、数据库（自建 PostgreSQL 16 + pgvector）

> 与后端、embedding 服务**同机**部署在轻量服务器上，走 localhost，延迟 <1ms。
> 系统：Ubuntu 22.04 LTS。以下命令在该服务器上以 root 执行。

### 1.1 安装 PostgreSQL 16 + pgvector

```bash
# 1. 添加 PostgreSQL 官方源（Ubuntu 22.04 默认是 PG 14，需升级到 16）
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-pgvector

# 2. 启动并设为开机自启
sudo systemctl enable --now postgresql
```

### 1.2 建库 + 建用户 + 启用 pgvector

```bash
sudo -u postgres psql <<'SQL'
CREATE USER spiritdex WITH PASSWORD '换成强密码';
CREATE DATABASE spiritdex OWNER spiritdex ENCODING 'UTF8';
\c spiritdex
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname='vector';  -- 应返回版本号
SQL
```

### 1.3 连接配置（仅本机访问）

数据库**只对本机后端开放**，不暴露公网，因此无需调白名单。确认
`/etc/postgresql/16/main/postgresql.conf` 里 `listen_addresses = 'localhost'`
（默认即是），`pg_hba.conf` 默认允许本机连接，无需改动。

后端连接串指向 localhost：
```
jdbc:postgresql://localhost:5432/spiritdex?stringtype=unspecified
```

### 1.4 初始化数据

Flyway 会在后端首次启动时自动执行全部迁移（V1~V9）建表。然后跑数据导入：

```bash
# 前置：先启动本地 embedding 服务（见下一节「embedding 服务」）
cd embedding-service && python server.py &  # 监听 :8710

# 1. 基础数据（精灵/技能/相克/文章；含完整技能池 20366 条）
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/spiritdex?stringtype=unspecified
export SPRING_DATASOURCE_USERNAME=spiritdex
export SPRING_DATASOURCE_PASSWORD=<password>
./mvnw spring-boot:run -Dspring-boot.run.profiles=seed

# 2. 文字 embedding（本地免费，无需 GLM 余额）
./mvnw spring-boot:run -Dspring-boot.run.profiles=rebuild-text

# 3. 可选：视觉向量（图片识别，需 GLM-4V，受 BWIKI 限流影响）
export GLM_API_KEY=<your-key>
./mvnw spring-boot:run -Dspring-boot.run.profiles=vision-seed
```

### 1.5 自动备份（pg_dump + 对象存储）

业务数据（AI 文章、未来 Phase 7 的用户/收藏）不能丢，必须定期备份。
方案：每日 `pg_dump` 导出到本地 + 同步到云对象存储（OSS/COS，几毛钱/月）。

```bash
# /usr/local/bin/spiritdex-backup.sh
#!/bin/bash
set -e
BACKUP_DIR=/var/backups/spiritdex
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M)
# custom 格式便于选择性恢复；保留最近 14 天
sudo -u postgres pg_dump --format=custom --file=$BACKUP_DIR/spiritdex_$DATE.dump spiritdex
find $BACKUP_DIR -name "*.dump" -mtime +14 -delete
# 同步到对象存储（需安装 ossutil / coscmd 并配好凭证）
# ossutil cp $BACKUP_DIR/spiritdex_$DATE.dump oss://your-bucket/spiritdex/
```

```bash
# 每天凌晨 3 点备份
sudo crontab -e
# 加入：0 3 * * * /usr/local/bin/spiritdex-backup.sh >> /var/log/spiritdex-backup.log 2>&1
```

恢复演练（定期做一次，确认备份可用）：
```bash
sudo -u postgres pg_restore --clean --if-exists -d spiritdex /var/backups/spiritdex_xxx.dump
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

## 二、后端（轻量应用服务器，Docker）

### 2.1 构建 Docker 镜像
```bash
cd spiritdex-api
docker build -t spiritdex-api .
```

### 2.2 运行
```bash
docker run -d --name spiritdex-api --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 127.0.0.1:8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/spiritdex?stringtype=unspecified \
  -e SPRING_DATASOURCE_USERNAME=spiritdex \
  -e SPRING_DATASOURCE_PASSWORD=<password> \
  -e GLM_API_KEY=<your-glm-key> \
  -e SPIRITDEX_CORS_ORIGINS=https://你的域名 \
  spiritdex-api
```
- `--add-host=host.docker.internal:host-gateway`：**Linux Docker 必需**。后端在容器里，
  PostgreSQL 在宿主机上，容器内的 `localhost` 指向容器自身而非宿主机。此参数让
  `host.docker.internal` 解析到宿主机网关，后端才能连到宿主机的 PG（Mac/Windows 的
  Docker Desktop 自带此映射，Linux 需显式加）
- `127.0.0.1:8080`：只监听本地，由 Nginx 反代对外（不直接暴露）

> 同理，embedding 服务（systemd，跑在宿主机）的 `SPIRITDEX_AI_LOCAL_EMBEDDING_URL`
> 默认 `localhost:8710` 对宿主机后端是对的，但后端在容器里时需改成
> `http://host.docker.internal:8710`（同样依赖上面的 `--add-host`）。
> 或把 embedding 也容器化、和后端用同一个 docker network 互通，避免 host 映射。
- 环境变量说明见下表

### 2.3 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `SPRING_DATASOURCE_URL` | 是 | 自建 PG 连接串，指向宿主机，含 `?stringtype=unspecified` |
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
| `api.你的域名` | 轻量服务器公网 IP | 后端 API（Nginx 反代到 :8080） |

## 五、部署后验证清单

- [ ] `https://你的域名` 首页加载正常
- [ ] `/pets` 精灵图鉴列表有数据（671 只）
- [ ] `/pets/pet-0001` 喵喵详情含种族值/进化链 + **技能表多行（特性/升级/血脉/技能石）**
- [ ] `/types/matrix` 相克表染色正常
- [ ] `/ai/chat` 提问能流式回答（需 GLM key）
- [ ] 后端 `https://api.你的域名/api/types` 返回 JSON
- [ ] CORS：前端能跨域调后端（无控制台报错）
- [ ] SSE：AI 问答流式（非一次性返回）
- [ ] 备份：手动跑一次 `spiritdex-backup.sh` 确认产出 `.dump` 且能 `pg_restore`

## 六、合规
- 域名解析国内 IP → **ICP 备案必须**
- AI Provider（智谱）→ 实名认证（已完成账号即可）
- 站内标注「非官方，数据仅供参考」（首页 footer 已有）
- 数据来源声明（BWIKI）
