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
```

产物（写入 `../data/seed/`）：

| 文件 | 条目数（2026-07-10 实测） | 说明 |
|---|---|---|
| `types.json` | 18 | 属性枚举（普通/草/火/...） |
| `pets.json` | 671 | 精灵主记录 |
| `skills.json` | 737 | 技能目录 |
| `pet_types.json` | 980 | 精灵↔属性关联（多属性精灵多条） |
| `pet_skills.json` | 671 | 精灵↔特性技能关联（每只 1 条） |
| `evolution_chains.json` | 264 | 进化链 |
| `evolution_stages.json` | 611 | 进化阶段（含等级/条件） |

## 已知限制

- **属性相克矩阵**：BWIKI Lua 模块中不存在，本脚本不产出；后端 `type` 表仅入库 18 个枚举。
- **完整技能池**：模块中每只精灵只有 1 个 `feature_skill`；native/stone/blood 技能池及
  解锁等级仅存在于页面级 wikitext 模板，本 Phase 未抓取（`pet_skills.json` 仅含特性技能）。

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
├── main.py              # 入口
├── requirements.txt     # requests
├── src/
│   ├── api.py           # MediaWiki API 封装（限速/重试/UA）
│   ├── lua_parser.py    # ★ Lua 表解析器（递归下降，纯标准库）
│   ├── fetcher.py       # 拉取+解析 5 模块 → RawData
│   ├── transformers.py  # RawData → seed items（字段映射/清洗）
│   ├── exporters.py     # 写出 data/seed/*.json
│   └── config.py        # 配置（环境变量可覆盖）
└── tests/
    ├── test_lua_parser.py
    └── fixtures/        # 真实模块缓存（回归用）
```
