## 项目简介

这是一个面向「知识库问答（RAG）」场景的前端 Demo，提供：

- **文档管理**：上传 PDF / Word 文档、查看文档列表、删除文档
- **知识库检索**：基于向量检索查看命中文档片段
- **流式问答**：在右侧聊天框中对已建知识库提问，流式返回答案并附带引用

前端完全无业务状态，只负责 UI 和调用后端 RAG 服务，默认对接的后端地址为：

- 生产：`https://api.fangdu.chat/python/api/v1/rag`
- 本地开发：通过 Vite 代理转发到 `http://127.0.0.1:8000`

## 技术栈

- **框架**：`React 19` + `TypeScript`
- **构建工具**：`Vite 8`
- **状态管理**：`@tanstack/react-query` 负责接口调用与缓存
- **HTTP 客户端**：`axios`
- **部署**：推荐 `Vercel`，当前配置支持部署在子路径 `/python-rga` 下

核心文件说明：

- `src/App.tsx`：应用入口，挂载 `DocumentSidebar` 和 `ChatPanel`，并在右上角显示当前后端 API 基础地址
- `src/components/DocumentSidebar.tsx`：文档上传 / 进度条 / 文档列表 / 删除文档
- `src/components/ChatPanel.tsx`：问答/仅检索模式切换、问题输入框、消息列表、流式渲染和引用展示
- `src/api/client.ts`：封装 `ragClient`，统一处理 `VITE_RAG_BASE_URL` 与默认生产地址
- `src/api/rag.ts`：对 `/documents`、`/retrieve`、`/ask`、`/ask/stream` 等后端接口进行函数封装
- `vite.config.ts`：开发环境代理 `/api` 到本地后端，生产构建时根据 `VITE_APP_BASE` 设置静态资源前缀
- `vercel.json`：在 Vercel 上将 `/python-rga/**` 重写到根路径静态资源，保证子路径部署正常

## 调用链路概览

**文档上传：**

1. 用户在左侧面板选择文件，触发 `DocumentSidebar.onPickFile`
2. 调用 `uploadDocumentWithProgress(file, onProgress)`（`src/api/rag.ts`）
3. 前端通过 `ragClient.post("/documents", FormData)` 调用后端上传接口
4. 上传完成后，`react-query` 失效化文档列表查询，自动刷新 UI

**文档列表与删除：**

- 列表：`useQuery` 调用 `listDocuments()` → `GET /documents` → 渲染每个文档名称与切片数量  
- 删除：点击删除按钮 → `deleteDocument(doc_id)` → `DELETE /documents/{doc_id}` → 刷新列表

**仅检索模式：**

1. 在顶部工具栏切换到「仅检索」
2. 输入查询语句，点击发送或回车
3. `retrieve({ query, top_k })` → `POST /retrieve`
4. 返回的 chunks 在右侧按命中分数、页码和内容展示，同时传给 `CitationBlock` 展示引用

**问答（RAG）模式：**

1. 在顶部工具栏选择「问答（RAG）」
2. 输入问题后发送
3. `askStream()` 调用 `POST /ask/stream` 建立 SSE/流式连接
4. `onToken` 持续推送 token，前端缓冲并合并到当前 assistant 消息
5. `done` 事件附带最终 citations，更新消息中的引用信息并停止 streaming

## 环境变量与运行方式

开发环境配置（详见 `.env.development` / `.env.example`）：

- `VITE_RAG_BASE_URL=/api/v1/rag`：前端请求统一走 `/api` 前缀，由 Vite 代理到本地后端
- `VITE_PROXY_TARGET=http://127.0.0.1:8000`：本地 Python RAG 服务地址
- `VITE_APP_BASE=/`：开发环境应用部署在站点根路径

生产环境示例（`.env.production`）：

- `VITE_APP_BASE=/python-rga/`：构建后静态资源前缀为 `/python-rga/`
- `VITE_RAG_BASE_URL=https://api.fangdu.chat/python/api/v1/rag`：直接调用线上 RAG 服务

本地开发步骤：

```bash
npm install
npm run dev
```

构建与预览：

```bash
npm run build
npm run preview
```

部署到 Vercel 时，需要确保：

- 构建命令使用 `npm run build`
- 输出目录为 `dist`
- 环境变量按上文生产示例配置
- `vercel.json` 已生效，用于将 `/python-rga/**` 请求重写为根路径静态资源


## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
