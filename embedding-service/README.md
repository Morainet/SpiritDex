# SpiritDex Embedding 服务

本地 sentence-transformers embedding（BAAI/bge-small-zh-v1.5，512维），
替代付费的智谱 GLM embedding-3。零 API 成本。

## 启动
```bash
pip install -r requirements.txt
python server.py   # :8710
```

## 接口
- `GET /health` — 健康检查
- `POST /v1/embeddings` — `{"input":"文本"}` → `{"data":[{"embedding":[...]}]}`

## 配置（环境变量）
- `EMBEDDING_MODEL`：模型名（默认 BAAI/bge-small-zh-v1.5）
- `EMBEDDING_PORT`：端口（默认 8710）
