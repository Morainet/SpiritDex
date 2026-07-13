# SpiritDex 抓取脚本（scraper）

从 **BWIKI 洛克王国:手游WIKI**（`wiki.biligame.com/rocom`）抓取游戏事实数据，
输出到 `../data/seed/*.json`，供后端 `SeedRunner` 入库。

## 数据源

BWIKI 以 **Lua 数据模块**结构化发布全部游戏数据，本脚本经 MediaWiki `api.php`
拉取（`action=parse&prop=wikitext`），**无需 HTML 解析、无需反爬**：

| 模块 | 内容 |
|---|---|
| `Module:PetData/Core` | 671 只精灵主属性（缩写键） |
| `Module:PetData/Index` | 精灵 ID 索引 |
| `Module:PetData/SkillCatalog` | 737 个技能目录 |
| `Module:PetData/Evolution` | 264 条进化链 |
| `Module:PetData/Handbook` | 图鉴信息（栖息地/课题） |

> 灰机wiki（`rocokingdom.huijiwiki.com`）已被 Cloudflare 封锁，不可用——见
> `../doc/implementation-plan.md` §4.1 决策记录。

## 合规

- QPS ≤ 1（请求最小间隔 1s）
- 自定义 UA，标明用途
- 遵守 robots.txt（已确认 wiki 内容页允许）
- 只取事实数据（数值/属性/技能参数），每条记录带 `source_url`

## 安装与运行

```bash
cd scraper
pip install -r requirements.txt   # 仅需 requests

# 实时抓取（联网，QPS≤1）
python3 main.py

# 离线模式：用 tests/fixtures/ 缓存（不联网，CI 友好）
python3 main.py --offline

# 仅看统计、不写文件
python3 main.py --stats

# 抓取完整技能池（native/stone/blood，覆盖 pet_skills.json；约 11 分钟，QPS≤1）
python3 main.py --skill-pools

# 抓取活动公告（→ activities.json，供后端 AI 攻略生成）
python3 main.py --activities --max-activities 5
```

产物（写入 `../data/seed/`）：

| 文件 | 条目数 | 说明 | 来源 |
|---|---|---|---|
| `types.json` | 18 | 属性枚举（普通/草/火/...） | 固定枚举 |
| `pets.json` | 671 | 精灵主记录 | `Module:PetData/Core` |
| `skills.json` | 737 | 技能目录 | `Module:PetData/SkillCatalog` |
| `pet_types.json` | 980 | 精灵↔属性关联（多属性精灵多条） | `Module:PetData/Core` |
| `pet_skills.json` | 671 → 数千 | 精灵↔技能（feature + native/stone/blood 技能池） | Core + 页面级模板（见 `--skill-pools`） |
| `evolution_chains.json` | 264 | 进化链 | `Module:PetData/Evolution` |
| `evolution_stages.json` | 611 | 进化阶段（含等级/条件） | `Module:PetData/Evolution` |
| `type_effectiveness.json` | 113 | 属性相克矩阵（攻击方/防御方/倍率） | `Widget:RestrainCalc.js` |
| `activities.json` | 可选 | 活动公告（供 AI 攻略生成） | 首页/搜索（见 `--activities`） |

> 主流程 `python main.py` 产出除 `activities.json` 外的全部文件（`pet_skills.json` 仅含 feature）。
> 完整技能池需额外运行 `python main.py --skill-pools`（覆盖 `pet_skills.json`）。
> 活动公告需额外运行 `python main.py --activities`。

## 已知限制

- **同名精灵多形态**：约 80 个精灵名对应多个形态（如「鸭吉吉」6 形态、「蹦蹦种子」4 形态），
  页面级 wikitext 仅记录「原始形态」技能池。`--skill-pools` 按精灵名去重抓取，同名精灵共用
  一份技能池数据（形态差异后续优化）。
- **活动抓取数据质量**：BWIKI 首页 wikitext 以 HTML 布局为主（非 wiki 模板），
  `activity_fetcher` 的模板解析与搜索策略常落空，退回首页文本兜底，`raw_text` 含较多 HTML
  标签。后端 `ArticleGenerationService` 在 `raw_text` 质量不足时会用 `fallbackTopics` 兜底，
  链路不阻塞；提升方向是寻找 BWIKI 的活动专题页/分类页作为更稳定数据源。

## 测试

```bash
python3 -m unittest tests.test_lua_parser -v
```

首次需先运行一次抓取或执行下方命令生成 fixtures（供真实数据回归）：

```bash
mkdir -p tests/fixtures && python3 -c "
import json, urllib.request
for m in ['Core','Index','SkillCatalog','Evolution','Handbook']:
    import urllib.parse
    pg = urllib.parse.quote(f'Module:PetData/{m}')
    url=f'https://wiki.biligame.com/rocom/api.php?action=parse&page={pg}&prop=wikitext&format=json'
    d=json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'SpiritDexWikiBot/0.1'})))
    open(f'tests/fixtures/Module_PetData_{m}.txt','w',encoding='utf-8').write(d['parse']['wikitext'])
    print('wrote', m)
"
```

## 模块结构

```
scraper/
├── main.py                 # 入口（主流程 / --activities / --skill-pools 三个分支）
├── requirements.txt        # requests
├── scripts/
│   └── probe_pet_skills.py # 探路脚本：分析精灵页面技能池结构（开发用）
├── src/
│   ├── api.py              # MediaWiki API 封装（限速/重试/POST 绕 WAF）
│   ├── lua_parser.py       # ★ Lua 表解析器（递归下降，纯标准库）
│   ├── widget_parser.py    # Widget:RestrainCalc.js 相克矩阵解析
│   ├── fetcher.py          # 拉取+解析 5 模块 → RawData
│   ├── activity_fetcher.py # 活动公告抓取（多策略容错 → activities.json）
│   ├── skill_pool_fetcher.py # 完整技能池抓取（native/stone/blood）
│   ├── transformers.py     # RawData → seed items（字段映射/清洗）
│   ├── exporters.py        # 写出 data/seed/*.json
│   └── config.py           # 配置（环境变量可覆盖）
└── tests/
    ├── test_lua_parser.py
    └── fixtures/           # 真实模块缓存（回归用）+ 探路页面样本
```
