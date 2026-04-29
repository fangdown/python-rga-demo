# RAG 对外接口文档（前端接入）

本文档面向前端同学，描述 RAG 一期可用接口、请求响应结构、错误处理和推荐调用流程。

## 基础信息

- 本地前缀：`/api/v1/rag`
- 线上前缀（按当前网关）：`https://api.fangdu.chat/python/api/v1/rag`
- 内容类型：
  - JSON 接口：`Content-Type: application/json`
  - 上传接口：`multipart/form-data`

---

## 1) 上传文档

### `POST /documents`

上传 PDF/Word 文档并写入知识库。

### 请求

- `multipart/form-data`
- 字段：
  - `file`（必填）：文件对象，支持 `.pdf/.doc/.docx`

### 响应 `200`

```json
{
  "doc_id": "a41d4f67-2f6d-4db5-9668-9c8dbfdbf17f",
  "filename": "产品需求说明.pdf",
  "chunk_count": 18
}
```

### 常见错误

- `400`：`{"detail":"文件名不能为空"}`
- `400`：`{"detail":"文件内容为空"}`
- `400`：`{"detail":"仅支持 PDF 或 Word 文件（.pdf/.docx/.doc）"}`

---

## 2) 文档列表

### `GET /documents`

查询已入库文档。

### 响应 `200`

```json
[
  {
    "doc_id": "a41d4f67-2f6d-4db5-9668-9c8dbfdbf17f",
    "filename": "产品需求说明.pdf",
    "chunk_count": 18
  }
]
```

---

## 3) 删除文档

### `DELETE /documents/{doc_id}`

删除文档及其向量片段。

### 响应 `200`

```json
{
  "status": "deleted",
  "doc_id": "a41d4f67-2f6d-4db5-9668-9c8dbfdbf17f"
}
```

### 常见错误

- `404`：`{"detail":"文档不存在"}`

---

## 4) 检索片段

### `POST /retrieve`

仅做向量检索，返回引用片段（不走大模型生成）。

### 请求体

```json
{
  "query": "退款规则是什么？",
  "top_k": 4
}
```

- `query`：必填，最少 1 个字符
- `top_k`：可选，范围 `1~20`；不传则使用后端默认值（当前默认 4）

### 响应 `200`

```json
{
  "chunks": [
    {
      "chunk_id": "a41d4f67-2f6d-4db5-9668-9c8dbfdbf17f_3",
      "content": "用户在订单完成后 7 天内可申请无理由退款...",
      "score": 0.2345,
      "filename": "售后政策.docx",
      "page": 1
    }
  ]
}
```

---

## 5) 问答接口（RAG）

### `POST /ask`

先检索再由大模型生成答案，并返回引用片段。

### 请求体

```json
{
  "question": "这份文档里退款时限是几天？",
  "top_k": 4
}
```

- `question`：必填，最少 1 个字符
- `top_k`：可选，范围 `1~20`

### 响应 `200`

```json
{
  "answer": "根据文档，订单完成后 7 天内可申请无理由退款。",
  "citations": [
    {
      "chunk_id": "a41d4f67-2f6d-4db5-9668-9c8dbfdbf17f_3",
      "content": "用户在订单完成后 7 天内可申请无理由退款...",
      "score": 0.2345,
      "filename": "售后政策.docx",
      "page": 1
    }
  ]
}
```

### 常见错误

- `400`：`{"detail":"未配置 DEEPSEEK_API_KEY"}`
- `422`：参数校验失败（例如 `top_k` 超出范围）

---

## 推荐前端调用顺序

1. 上传文档：`POST /documents`
2. 渲染文档列表：`GET /documents`
3. 对话场景：
   - 先调 `POST /ask` 直接拿答案 + 引用
   - 如需“仅检索预览”，调 `POST /retrieve`
4. 文档管理：按需调用 `DELETE /documents/{doc_id}`

---

## 前端展示建议

- 对 `citations` 显示：文件名 + 页码 + 片段内容
- 支持“展开/收起引用”
- 当 `answer` 提示“上下文不足”时，引导用户：
  - 继续上传文档，或
  - 改写问题关键词

---

## Axios 示例

```ts
import axios from "axios";

const api = axios.create({
  baseURL: "https://api.fangdu.chat/python/api/v1/rag",
});

export async function ragAsk(question: string, topK = 4) {
  const { data } = await api.post("/ask", { question, top_k: topK });
  return data;
}
```

