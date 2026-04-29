import { useState } from "react";
import type { Chunk } from "../api/types";

export function CitationBlock({ citations }: { citations: Chunk[] }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (!citations.length) return null;
  const visible = showAll ? citations : citations.slice(0, 5);

  return (
    <div className="rag-cite-wrap">
      <button
        type="button"
        className="rag-cite-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "▼" : "▶"} 引用来源（{citations.length}）
      </button>
      {open && (
        <div className="rag-cite-list">
          {visible.map((c) => (
            <article key={c.chunk_id} className="rag-cite-card">
              <div className="rag-cite-head">
                <strong>{c.filename}</strong>
                <span>第 {c.page} 页</span>
                <span className="rag-score">score {c.score.toFixed(4)}</span>
              </div>
              <div className="rag-cite-body">{c.content}</div>
            </article>
          ))}
          {citations.length > 5 && (
            <button
              type="button"
              className="rag-cite-toggle"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "收起多余引用"
                : `展开其余 ${citations.length - 5} 条引用`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
