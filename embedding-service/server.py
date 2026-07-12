"""本地 Embedding 服务（sentence-transformers + FastAPI）。

用 BAAI/bge-small-zh-v1.5（512 维，中文检索质量好，体积小、CPU 可跑）。
完全本地、零 API 成本，替代智谱 GLM embedding-3（付费）。

启动：
    pip install sentence-transformers fastapi uvicorn
    python server.py
默认监听 http://localhost:8710

接口（OpenAI embeddings 兼容）：
    POST /v1/embeddings  {"input": "文本或列表"}  → {"data":[{"embedding":[...]}]}
    GET  /health
"""

from __future__ import annotations

import os
from typing import List, Union

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

# 模型：bge-small-zh-v1.5（512维，中文优化，约 100MB，首次启动自动下载）
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
PORT = int(os.getenv("EMBEDDING_PORT", "8710"))

app = FastAPI(title="SpiritDex Embedding Service")
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"[embedding] 加载模型 {MODEL_NAME} ...", flush=True)
        _model = SentenceTransformer(MODEL_NAME)
        print(f"[embedding] 就绪，维度 {_model.get_sentence_embedding_dimension()}", flush=True)
    return _model


class EmbedRequest(BaseModel):
    input: Union[str, List[str]]


@app.get("/health")
def health():
    dim = _model.get_sentence_embedding_dimension() if _model else None
    return {"status": "ok", "model": MODEL_NAME, "dim": dim}


@app.post("/v1/embeddings")
def embeddings(req: EmbedRequest):
    model = get_model()
    texts = [req.input] if isinstance(req.input, str) else req.input
    # bge 中文模型推荐加 query 前缀提升检索质量（对查询文本）
    vecs = model.encode(texts, normalize_embeddings=True).tolist()
    return {"data": [{"embedding": v} for v in vecs]}


if __name__ == "__main__":
    get_model()  # 预热
    print(f"[embedding] 服务启动于 :{PORT}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
