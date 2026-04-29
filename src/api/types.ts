/** Types aligned with RAG_API.md */

export interface DocumentRow {
  doc_id: string;
  filename: string;
  chunk_count: number;
}

export interface UploadDocumentResponse {
  doc_id: string;
  filename: string;
  chunk_count: number;
}

export interface DeleteDocumentResponse {
  status: string;
  doc_id: string;
}

export interface Chunk {
  chunk_id: string;
  content: string;
  score: number;
  filename: string;
  page: number;
}

export interface RetrieveResponse {
  chunks: Chunk[];
}

export interface AskResponse {
  answer: string;
  citations: Chunk[];
}

export interface RetrieveRequestBody {
  query: string;
  top_k?: number;
}

export interface AskRequestBody {
  question: string;
  top_k?: number;
}

export interface AskStreamTokenEvent {
  type: "token";
  text: string;
}

export interface AskStreamDoneEvent {
  type: "done";
  mode: "rag" | "fallback_direct_llm";
  citations: Chunk[];
}

export interface AskStreamErrorEvent {
  type: "error";
  message: string;
}

export type AskStreamEvent =
  | AskStreamTokenEvent
  | AskStreamDoneEvent
  | AskStreamErrorEvent;
