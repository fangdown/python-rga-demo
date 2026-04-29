import { ragClient } from "./client";
import type {
  AskRequestBody,
  AskResponse,
  AskStreamDoneEvent,
  AskStreamEvent,
  DeleteDocumentResponse,
  DocumentRow,
  RetrieveRequestBody,
  RetrieveResponse,
  UploadDocumentResponse,
} from "./types";
import { getRagBaseURL } from "./client";

export async function uploadDocument(file: File) {
  const body = new FormData();
  body.append("file", file);
  const { data } = await ragClient.post<UploadDocumentResponse>(
    "/documents",
    body,
  );
  return data;
}

export async function uploadDocumentWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
) {
  const body = new FormData();
  body.append("file", file);
  const { data } = await ragClient.post<UploadDocumentResponse>(
    "/documents",
    body,
    {
      onUploadProgress: (evt) => {
        if (!evt.total || !onProgress) return;
        const percent = Math.round((evt.loaded / evt.total) * 100);
        onProgress(Math.min(100, Math.max(0, percent)));
      },
    },
  );
  return data;
}

export async function listDocuments() {
  const { data } = await ragClient.get<DocumentRow[]>("/documents");
  return data;
}

export async function deleteDocument(docId: string) {
  const { data } = await ragClient.delete<DeleteDocumentResponse>(
    `/documents/${docId}`,
  );
  return data;
}

export async function retrieve(body: RetrieveRequestBody) {
  const { data } = await ragClient.post<RetrieveResponse>("/retrieve", body);
  return data;
}

export async function ask(body: AskRequestBody) {
  const { data } = await ragClient.post<AskResponse>("/ask", body);
  return data;
}

export async function askStream(
  body: AskRequestBody,
  handlers: {
    onToken: (text: string) => void;
    onDone: (event: AskStreamDoneEvent) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
) {
  const response = await fetch(`${getRagBaseURL()}/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("流式响应不可用");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finished = false;

  const processEvent = (rawEvent: string) => {
    const normalized = rawEvent.replace(/\r\n/g, "\n");
    const line = normalized
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.startsWith("data:"));
    if (!line) return;

    const payload = line.slice(5).trim();
    if (!payload) return;

    let event: AskStreamEvent;
    try {
      event = JSON.parse(payload) as AskStreamEvent;
    } catch {
      return;
    }

    if (event.type === "token") {
      handlers.onToken(event.text);
      return;
    }

    if (event.type === "done") {
      handlers.onDone(event);
      finished = true;
      return;
    }

    handlers.onError(event.message);
    finished = true;
  };

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      processEvent(rawEvent);
      if (finished) break;
    }
  }

  if (!finished && buffer.trim()) {
    processEvent(buffer);
  }

  try {
    await reader.cancel();
  } catch {
    // ignore cancel errors
  }
}
