# 灵宠档案（SpiritDex）部署指南 · RDS + 云服务器（分离架构）

> 本文是**正式生产架构**的部署指南：**云数据库 RDS（托管 PostgreSQL）+ 云服务器 ECS（跑后端 + embedding 服务）+ Vercel（前端）**，三者分离部署、各自可独立扩缩容。
>
> 与 [`deployment.md`](deployment.md)（轻量服务器同机部署）的区别：
> - `deployment.md`：DB/后端/embedding 全装**一台轻量服务器**，省钱、零内网延迟、适合个人/MVP
> - **本文**：DB 用**云托管 RDS**（自动备份/高可用/免运维），后端用 **ECS**，适合正式上线、团队、需稳定性的场景
>
> **选哪个？** 数据量小（150MB）、无多实例需求 → `deployment.md` 足够；要自动备份、高可用、未来扩容 → 用本文。

## 架构

```
用户 → Vercel（前端 Next.js，全球 CDN，HTTPS）
                ↓ fetch
         api.你的域名 → Nginx（HTTPS 反代）→ ECS 云服务器
                                            ├─ Spring Boot 后端（Docker，:8080 仅本机）
                                            └─ Embedding 服务（Python，:8710 仅本机）
                                                  ↓ JDBC（内网）
                                         云数据库 RDS PostgreSQL 16 + pgvector
                                            ↑
                                         智谱 GLM（chat/vision，外网 API）
```

**职责分离：**
| 组件 | 承载 | 扩展性 |
|---|---|---|
| 前端 | Vercel（免费档） | push 即部署，自动 HTTPS + CDN |
| 后端 + embedding | 一台 ECS（2C4G 起步） | 可随时升配/加机 |
| 数据库 | 云 RDS（1C1G 起步） | 自动备份、可升配、免运维 |

> **为什么 DB 用 RDS 而非自建？** RDS 自动每日备份 + 时间点恢复 + 扩容免停机 + 安全补丁自动打。
> 本项目业务数据（AI 生成的活动攻略、未来 Phase 7 用户/收藏）丢不得，RDS 的托管备份比自建 `pg_dump` cron 可靠得多。

---

## 前置准备（耗时项，先启动）

### 0.1 域名 + ICP 备案（7-20 工作日，最先办）

国内云的 ECS 和 RDS，**域名解析到国内 IP 必须 ICP 备案**，否则 80/443 端口被拦截。

- 买域名（阿里云/腾讯云均可）
- 立即提交 ICP 备案（备案期间域名不能对外访问，但可内部调试用 IP）
- 备案需：身份证 + 域名证书 + 服务器实例（ECS 需≥3个月有效期）

### 0.2 智谱 GLM 账号实名（AI 功能需要）

- 注册 [智谱开放平台](https://open.bigmodel.cn/) → 实名认证 → 创建 API Key
- 无 key 时后端 AI 功能自动降级（站点仍可用，只是 AI 问答/攻略生成不可用）

---

## 一、云数据库 RDS PostgreSQL

### 1.1 创建实例

- **选型**：PostgreSQL **16**（必须，pgvector 需要）
- **规格**：1 核 1G 起步（数据量约 150MB，免费/入门档够用）
- **存储**：20G 起步（SSD）
- **区域**：**与 ECS 同区域同可用区**（走内网，零延迟、免流量费）
- **网络**：选 VPC（与 ECS 同一个 VPC）

> ⚠️ **必须确认 RDS 支持 pgvector 扩展**。阿里云 RDS for PostgreSQL 14+ 支持；
> 腾讯云 PostgreSQL 16 自带。购买前在云商文档搜 "pgvector" 确认，或问客服。
> 若所选 RDS 不支持 pgvector，本项目无法运行（向量检索是核心）。

### 1.2 建库 + 建用户

RDS 创建后，用云商提供的连接方式（通常控制台有 DMS 或 psql 连接串）登录：

```sql
CREATE USER spiritdex WITH PASSWORD '换成强密码_含大小写数字符号';
CREATE DATABASE spiritdex OWNER spiritdex ENCODING 'UTF8';
```

### 1.3 启用 pgvector 扩展

⚠️ **RDS 的 pgvector 必须在目标库里手动启用**（后端 Flyway 的 `CREATE EXTENSION` 在 RDS 上可能因权限失败，**强烈建议手动先开**）：

```sql
\c spiritdex
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname='vector';  -- 应返回版本号，如 0.7.x
```

若报权限不足：RDS 控制台 → 数据库管理 → 用**高权限账号**（或初始 root 账号）执行上述语句。

### 1.4 白名单：放行 ECS 内网 IP

RDS 默认不对外开放。在 RDS 控制台 → **数据安全性 / 白名单设置**：
- 添加 ECS 的**内网 IP**（ECS 实例详情页可查，形如 `172.16.x.x`）
- ⚠️ **不要**加 ECS 公网 IP（走公网既慢又不安全）
- 也**不要**加 `0.0.0.0/0`（全网开放，危险）

### 1.5 拿到内网连接地址

RDS 控制台 → 数据库连接 → **内网地址**（形如 `pgm-xxx.pg.rds.aliyuncs.com:5432`）。
后端将用这个地址连接，**走 VPC 内网，不耗公网流量、延迟 <1ms**。

> 备份：RDS 自带自动备份（通常保留 7 天），控制台可设。比自建 `pg_dump` 可靠，
> 但建议仍偶尔做一次手动快照，重大变更前尤其要做。

---

## 二、ECS 云服务器（后端 + embedding）

### 2.1 购买 ECS

- **系统**：Ubuntu 22.04 LTS
- **规格**：2 核 4G 起步（后端 Java + embedding 模型常驻，2G 吃紧）
- **区域**：**与 RDS 同区域同可用区**（内网互通前提）
- **网络**：加入 RDS 所在的同一个 VPC
- **带宽**：按固定带宽 1-5Mbps（API 流量不大）或按量
- **安全组**：开放 **22（SSH）**、**80/443（HTTP/HTTPS）**；**不要开放 5432/8080/8710**

### 2.2 安装基础环境

SSH 登录 ECS 后：

```bash
# Docker（跑后端）
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker

# Python + venv（跑 embedding 服务）
sudo apt update && sudo apt install -y python3 python3-venv

# Nginx（反代 + HTTPS）
sudo apt install -y nginx

# Certbot（Let's Encrypt 免费证书）
sudo apt install -y certbot python3-certbot-nginx
```

### 2.3 部署 Embedding 服务（免费，AI 问答向量检索用）

```bash
sudo mkdir -p /opt/spiritdex && cd /opt/spiritdex
sudo git clone <你的仓库地址> repo
cd repo/embedding-service

# 用 venv 隔离依赖
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r requirements.txt
```

systemd 守护进程（开机自启 + 崩溃自动拉起）：

```ini
# /etc/systemd/system/spiritdex-embedding.service
[Unit]
Description=SpiritDex Embedding Service
After=network.target

[Service]
WorkingDirectory=/opt/spiritdex/repo/embedding-service
ExecStart=/opt/spiritdex/repo/embedding-service/venv/bin/python server.py
Restart=always
RestartSec=5
# 模型加载需较大内存，避免被 OOM killer 误杀
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spiritdex-embedding
# 首次启动会下载模型（~100MB），查日志确认就绪
sudo journalctl -u spiritdex-embedding -f
# 看到 "[embedding] 就绪，维度 512" 即成功

# 验证
curl http://localhost:8710/health
```

### 2.4 构建并运行后端（Docker）

```bash
cd /opt/spiritdex/repo/spiritdex-api
sudo docker build -t spiritdex-api .
```

运行（**注意 `host.docker.internal`**——后端在容器里，embedding 在宿主机，需此映射）：

```bash
sudo docker run -d --name spiritdex-api --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 127.0.0.1:8080:8080 \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://<RDS内网地址>:5432/spiritdex?stringtype=unspecified' \
  -e SPRING_DATASOURCE_USERNAME=spiritdex \
  -e SPRING_DATASOURCE_PASSWORD='<强密码>' \
  -e GLM_API_KEY='<智谱key>' \
  -e SPIRITDEX_CORS_ORIGINS='https://你的域名,https://www.你的域名' \
  -e SPIRITDEX_AI_LOCAL_EMBEDDING_URL='http://host.docker.internal:8710' \
  -e SPIRITDEX_AI_ARTICLEGENERATION_ENABLED=true \
  spiritdex-api
```

**关键参数解释：**
| 参数 | 说明 |
|---|---|
| `--add-host=host.docker.internal:host-gateway` | **Linux Docker 必需**。后端在容器里，embedding 在宿主机，容器内 `localhost` 指向容器自身。此参数让容器能访问宿主机的 embedding 服务 |
| `-p 127.0.0.1:8080:8080` | 只监听本机，由 Nginx 反代对外，**不直接暴露公网** |
| `SPIRITDEX_AI_LOCAL_EMBEDDING_URL` | 容器内必须用 `host.docker.internal:8710`，不是 `localhost`（同上原因） |
| `SPIRITDEX_AI_ARTICLEGENERATION_ENABLED=true` | **开启定时 AI 活动攻略生成**（每周一生成、周二发布）。不设则定时任务不跑，需手动调管理 API |

查日志确认启动成功（Flyway 自动建表）：
```bash
sudo docker logs -f spiritdex-api
# 看到 "Successfully applied migrations" + "Started SpiritdexApiApplication" 即成功
```

### 2.5 Nginx 反代 + HTTPS

```bash
# 先把域名解析到 ECS 公网 IP（备案通过后），再签证书
sudo certbot --nginx -d api.你的域名
# certbot 自动改 nginx 配置 + 申请证书 + 设定时自动续期
```

补充 SSE 配置（**AI 问答流式必须关 proxy_buffering**，否则前端收不到流）：

```nginx
# /etc/nginx/sites-available/api.你的域名（certbot 生成后手动补充 location 块）
server {
    listen 443 ssl http2;
    server_name api.你的域名;
    # ssl_certificate / ssl_certificate_key 由 certbot 自动填好

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ★ SSE 流式必须（AI 问答/推荐流式输出）
        proxy_buffering off;
        proxy_cache off;

        # AI 问答可能较慢，适当拉长超时
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 三、初始化数据（一次性）

后端首次启动已建好表（Flyway V1~V9），现在导入种子数据 + 建向量索引。

### 3.1 导入基础数据（精灵/技能/相克/文章）

```bash
cd /opt/spiritdex/repo/spiritdex-api

# 用与运行时相同的数据源环境变量（指向 RDS），激活 seed profile
sudo SPRING_DATASOURCE_URL='jdbc:postgresql://<RDS内网地址>:5432/spiritdex?stringtype=unspecified' \
     SPRING_DATASOURCE_USERNAME=spiritdex \
     SPRING_DATASOURCE_PASSWORD='<强密码>' \
     docker run --rm --network host spiritdex-api \
     java -jar app.jar --spring.profiles.active=seed
```

> `--network host` 让容器直接用宿主机网络访问 RDS（ECS 与 RDS 内网互通）。
> 也可用 `--add-host` + 内网地址，但 host 模式更简单。

### 3.2 建文字向量索引（让 AI 问答能检索精灵）

```bash
# embedding 服务必须已在 :8710 运行（见 2.3）
sudo docker run --rm --network host \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://<RDS内网地址>:5432/spiritdex?stringtype=unspecified' \
  -e SPRING_DATASOURCE_USERNAME=spiritdex \
  -e SPRING_DATASOURCE_PASSWORD='<强密码>' \
  -e SPIRITDEX_AI_LOCAL_EMBEDDING_URL='http://localhost:8710' \
  spiritdex-api java -jar app.jar --spring.profiles.active=rebuild-text
```

### 3.3 可选：建视觉向量（图片识别精灵用）

```bash
sudo docker run --rm --network host \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://<RDS内网地址>:5432/spiritdex?stringtype=unspecified' \
  -e SPRING_DATASOURCE_USERNAME=spiritdex \
  -e SPRING_DATASOURCE_PASSWORD='<强密码>' \
  -e GLM_API_KEY='<智谱key>' \
  spiritdex-api java -jar app.jar --spring.profiles.active=vision-seed
```

> 这步受 BWIKI 立绘图片限流影响，较慢（671 只逐个调 GLM-4V），失败可重跑。

### 3.4 可选：手动触发首篇 AI 活动攻略

定时任务默认周一才跑。想立即测试，调管理 API（后端起来后）：

```bash
# 生成活动攻略 + 每周培养榜（落 draft）
curl -X POST http://localhost:8080/api/admin/articles/generate

# 查看草稿
curl http://localhost:8080/api/admin/articles/drafts

# 手动把到期草稿转发布（含建 embedding 索引）
curl -X POST http://localhost:8080/api/admin/articles/publish-due
```

> ⚠️ 管理端点当前无鉴权（Phase 7 才接 Spring Security）。生产上线前用 Nginx 给
> `/api/admin/*` 加 IP 白名单或 basic auth，否则任何人都能触发 AI 调用消耗 token。

---

## 四、前端（Vercel）

### 4.1 导入项目
- Vercel → New Project → 导入 spiritdex-web 仓库
- Framework Preset: Next.js（自动识别）

### 4.2 环境变量（Vercel 控制台 Settings → Environment Variables）

| 变量 | 值 |
|---|---|
| `BACKEND_URL` | `https://api.你的域名`（后端公网 HTTPS 地址） |

### 4.3 部署
push 到 main 分支即自动部署。Vercel 自动 HTTPS + 全球 CDN。
图片域名白名单（`wiki.biligame.com` 等）已在 `next.config.ts` 配好，无需额外设置。

> 国内访问 Vercel 偶有波动。若主流量在国内且体验不佳，前端可改部署到 ECS（`next build && next start`，用 Nginx 托管），与后端同域。

---

## 五、域名规划

| 域名 | 指向 | 用途 |
|---|---|---|
| `你的域名`（或 www） | Vercel | 前端 |
| `api.你的域名` | ECS 公网 IP | 后端 API（Nginx 反代到 :8080） |
| （RDS 内网地址） | 仅 VPC 内网 | 数据库，不对外解析 |

---

## 六、成本估算（月）

| 组件 | 选型 | 费用 |
|---|---|---|
| ECS | 2C4G 按月 | 约 60-120 元 |
| RDS PostgreSQL | 1C1G 入门档 | 约 50-100 元 |
| 域名 | 普通 .com | 约 50-70 元/年 |
| Vercel | 免费档 | 0 |
| 智谱 GLM | 免费额度（glm-4-flash） | 0（超额才计费） |
| HTTPS | Let's Encrypt | 0 |
| **合计** | | **约 120-250 元/月** |

> 对比 `deployment.md` 的轻量服务器方案（单台 60-100 元/月）：RDS 方案贵约 60-150 元，
> 换来的是数据库自动备份/高可用/免运维。数据安全性要求高就值得。

---

## 七、部署后验证清单

**数据库：**
- [ ] `psql` 连 RDS 内网地址成功，`\dx` 能看到 `vector` 扩展

**后端：**
- [ ] `curl https://api.你的域名/api/types` 返回 JSON（CORS、Nginx、后端都通）
- [ ] `curl https://api.你的域名/api/pets?size=1` 返回精灵数据（seed 导入成功）
- [ ] `docker logs spiritdex-api` 无报错

**AI 功能：**
- [ ] `curl https://api.你的域名/api/ai/chat` 提问能流式回答（GLM key + SSE 正常）
- [ ] `curl localhost:8710/health` 返回 `{"dim":512}`（embedding 服务就绪）
- [ ] 管理端点 `POST /api/admin/articles/generate` 能产出 draft 文章

**前端：**
- [ ] `https://你的域名` 首页加载正常
- [ ] `/pets` 精灵图鉴列表有数据（671 只）
- [ ] `/pets/pet-0001` 详情含种族值/进化链/技能表
- [ ] `/types/matrix` 相克表染色正常
- [ ] `/ai/chat` 提问流式回答（浏览器无控制台 CORS 报错）
- [ ] `/articles` 攻略列表能看到 AI 生成的活动攻略（带「AI」徽章）

**安全：**
- [ ] ECS 安全组未开放 5432/8080/8710
- [ ] RDS 白名单只有 ECS 内网 IP
- [ ] `/api/admin/*` 已加 Nginx 访问限制
- [ ] ICP 备案通过

---

## 八、运维操作速查

### 更新后端代码
```bash
cd /opt/spiritdex/repo && sudo git pull
cd spiritdex-api && sudo docker build -t spiritdex-api . && sudo docker restart spiritdex-api
```

### 更新数据（重新抓 BWIKI）
```bash
cd /opt/spiritdex/repo/scraper && python3 main.py           # 抓精灵数据
python3 main.py --activities                                 # 抓活动公告
# 然后重跑 3.1 的 seed 导入
```

### 查看 RDS 慢查询 / 连接数
RDS 控制台 → 性能洞察 / 数据库连接，云商有可视化面板。

### 应急：RDS 切换到备库 / 时间点恢复
RDS 控制台 → 备份恢复 → 选时间点或快照，几分钟内拉起一个新实例。这是 RDS 相对自建 PG 最大的运维优势。

---

## 九、合规

- 域名解析国内 IP → **ICP 备案必须**（备案期间无法对外访问）
- AI Provider（智谱 GLM）→ 账号实名认证
- 站内标注「非官方，数据仅供参考」（首页 footer 已有）
- 数据来源声明 BWIKI（攻略文章页 AI 生成内容已带来源链接）

---

## 附：与轻量服务器方案的决策对照

| 维度 | 本文（RDS + ECS） | deployment.md（轻量同机） |
|---|---|---|
| 数据库 | 云托管 RDS（自动备份/高可用） | 自建 PG（手动 pg_dump cron） |
| 故障恢复 | RDS 时间点恢复，分钟级 | 需手动 pg_restore，依赖备份完整性 |
| 运维成本 | DB 免运维 | 需自己维护 PG 版本/安全补丁 |
| 月费用 | 约 120-250 元 | 约 60-100 元 |
| 性能 | DB 与后端内网，<1ms 延迟 | 同机 localhost，零延迟 |
| 适用 | 正式生产、需稳定性、团队 | 个人项目、MVP、省钱优先 |
