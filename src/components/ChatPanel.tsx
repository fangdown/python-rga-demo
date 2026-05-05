import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { askStream, retrieve } from "../api/rag";
import { getApiErrorMessage } from "../api/errors";
import type { AskStreamDoneEvent, Chunk } from "../api/types";
import { CitationBlock } from "./CitationBlock";
import { MessageContent } from "./MessageContent";

type Mode = "ask" | "retrieve";

type MsgUser = { id: string; role: "user"; content: string };
type MsgAssistant = {
  id: string;
  role: "assistant";
  mode: Mode;
  content: string;
  streaming?: boolean;
  citations?: Chunk[];
  chunks?: Chunk[];
};

type ChatMessage = MsgUser | MsgAssistant;

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampTopK(n: number): number {
  if (Number.isNaN(n)) return 4;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

export function ChatPanel({ onError }: { onError: (msg: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [topK, setTopK] = useState(4);
  const [mode, setMode] = useState<Mode>("ask");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamControllerRef = useRef<AbortController | null>(null);
  const streamAssistantIdRef = useRef<string | null>(null);
  const pendingTokenBufferRef = useRef("");
  const rafFlushRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const topKValid = useMemo(() => clampTopK(topK), [topK]);

  const runRetrieve = useMutation({
    mutationFn: async (query: string) => {
      return retrieve({ query, top_k: topKValid });
    },
  });

  const pending = isStreaming || runRetrieve.isPending;

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages]);

  const flushPendingTokens = useCallback((assistantId: string) => {
    const chunk = pendingTokenBufferRef.current;
    if (!chunk) return;
    pendingTokenBufferRef.current = "";
    setMessages((m) =>
      m.map((msg) =>
        msg.id === assistantId
          ? {
              ...msg,
              content: msg.content + chunk,
            }
          : msg,
      ),
    );
  }, []);

  const scheduleTokenFlush = useCallback(
    (assistantId: string) => {
      if (rafFlushRef.current !== null) return;
      rafFlushRef.current = window.requestAnimationFrame(() => {
        rafFlushRef.current = null;
        flushPendingTokens(assistantId);
      });
    },
    [flushPendingTokens],
  );

  const stopStreaming = useCallback(() => {
    streamControllerRef.current?.abort();
    setIsStreaming(false);
    const assistantId = streamAssistantIdRef.current;
    if (assistantId) {
      flushPendingTokens(assistantId);
    }
    if (rafFlushRef.current !== null) {
      window.cancelAnimationFrame(rafFlushRef.current);
      rafFlushRef.current = null;
    }
    if (!assistantId) return;
    setMessages((m) =>
      m.map((msg) =>
        msg.id === assistantId &&
        msg.role === "assistant" &&
        !msg.content.trim()
          ? {
              ...msg,
              content: "（已停止回答）",
            }
          : msg,
      ),
    );
  }, [flushPendingTokens]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    const userMsg: MsgUser = { id: id(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);

    try {
      if (mode === "ask") {
        const assistantId = id();
        const assistant: MsgAssistant = {
          id: assistantId,
          role: "assistant",
          mode: "ask",
          content: "",
          streaming: true,
          citations: [],
        };
        setMessages((m) => [...m, assistant]);
        setIsStreaming(true);
        streamAssistantIdRef.current = assistantId;
        pendingTokenBufferRef.current = "";
        const controller = new AbortController();
        streamControllerRef.current = controller;

        const applyDone = (event: AskStreamDoneEvent) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    streaming: false,
                    citations: event.citations ?? [],
                  }
                : msg,
            ),
          );
        };

        try {
          await askStream(
            { question: text, top_k: topKValid },
            {
              onToken: (token) => {
                pendingTokenBufferRef.current += token;
                scheduleTokenFlush(assistantId);
              },
              onDone: (event) => {
                flushPendingTokens(assistantId);
                applyDone(event);
              },
              onError: (message) => {
                flushPendingTokens(assistantId);
                setMessages((m) =>
                  m.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          streaming: false,
                          content: msg.content || `请求失败：${message}`,
                        }
                      : msg,
                  ),
                );
                onError(message);
              },
            },
            controller.signal,
          );
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            loggerSafeAbort();
            return;
          }
          throw e;
        } finally {
          flushPendingTokens(assistantId);
          if (rafFlushRef.current !== null) {
            window.cancelAnimationFrame(rafFlushRef.current);
            rafFlushRef.current = null;
          }
          pendingTokenBufferRef.current = "";
          setIsStreaming(false);
          streamControllerRef.current = null;
          streamAssistantIdRef.current = null;
        }
      } else {
        const data = await runRetrieve.mutateAsync(text);
        const lines = data.chunks.map(
          (c) =>
            `【${c.filename} p.${c.page}】(${c.score.toFixed(4)})\n${c.content}`,
        );
        const assistant: MsgAssistant = {
          id: id(),
          role: "assistant",
          mode: "retrieve",
          content: lines.length ? lines.join("\n\n—\n\n") : "（无检索结果）",
          chunks: data.chunks,
        };
        setMessages((m) => [...m, assistant]);
      }
    } catch (e) {
      setIsStreaming(false);
      onError(getApiErrorMessage(e));
      setMessages((m) => [
        ...m,
        {
          id: id(),
          role: "assistant",
          mode,
          content: `请求失败：${getApiErrorMessage(e)}`,
        },
      ]);
    }
  }, [
    flushPendingTokens,
    input,
    mode,
    onError,
    pending,
    runRetrieve,
    scheduleTokenFlush,
    topKValid,
  ]);

  function loggerSafeAbort() {
    // no-op: user-initiated stop should not show global error toast
  }

  return (
    <main className="rag-main" id="chat">
      <div className="rag-toolbar">
        <div className="rag-toolbar-title">
          <div className="rag-section-label">Console</div>
          <h2>问答控制台</h2>
        </div>
        <div className="rag-toolbar-controls">
          <div className="rag-seg" role="group" aria-label="模式" id="retrieve">
            <button
              type="button"
              data-on={mode === "ask"}
              onClick={() => setMode("ask")}
            >
              问答（RAG）
            </button>
            <button
              type="button"
              data-on={mode === "retrieve"}
              onClick={() => setMode("retrieve")}
            >
              仅检索
            </button>
          </div>
          <label>
            top_k
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="rag-chat-scroll" ref={chatScrollRef}>
        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="rag-msg rag-msg-user">
              <div className="rag-bubble">
                <MessageContent text={msg.content} />
              </div>
            </div>
          ) : (
            <div key={msg.id} className="rag-msg rag-msg-assistant">
              <div className="rag-bubble">
                {msg.mode === "ask" && !msg.content.trim() ? (
                  <div className="rag-thinking" aria-live="polite">
                    <span className="rag-thinking-dot" />
                    <span>正在思考并组织答案</span>
                  </div>
                ) : (
                  <MessageContent text={msg.content} />
                )}
                {msg.mode === "ask" && msg.citations && (
                  <CitationBlock citations={msg.citations} />
                )}
                {msg.mode === "retrieve" && msg.chunks?.length ? (
                  <CitationBlock citations={msg.chunks} />
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="rag-composer">
        <div className="rag-composer-inner">
          <div className="rag-composer-row">
            <textarea
              className="rag-textarea"
              rows={2}
              placeholder={
                mode === "ask"
                  ? "输入要向知识库提出的问题…"
                  : "输入检索关键词或句子…"
              }
              value={input}
              disabled={pending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            {isStreaming ? (
              <button
                type="button"
                className="rag-stop"
                onClick={stopStreaming}
              >
                停止回答
              </button>
            ) : (
              <button
                type="button"
                className="rag-primary"
                disabled={pending || !input.trim()}
                onClick={() => void submit()}
              >
                {pending ? (
                  <>
                    <span className="rag-spinner" aria-hidden />
                    处理中
                  </>
                ) : (
                  "发送"
                )}
              </button>
            )}
          </div>
          <div className="rag-hint">Enter 发送 · Shift+Enter 换行 · top_k 1-20</div>
        </div>
      </div>
    </main>
  );
}
