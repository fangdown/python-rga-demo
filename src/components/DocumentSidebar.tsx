import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteDocument,
  listDocuments,
  uploadDocumentWithProgress,
} from "../api/rag";
import { getApiErrorMessage } from "../api/errors";

const qk = { documents: ["rag", "documents"] as const };

export function DocumentSidebar({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadName, setUploadName] = useState("");

  const docsQuery = useQuery({
    queryKey: qk.documents,
    queryFn: listDocuments,
  });

  const del = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents }),
    onError: (e) => onError(getApiErrorMessage(e)),
  });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setUploadName(file.name);
    setUploadProgress(0);
    try {
      await uploadDocumentWithProgress(file, setUploadProgress);
      setUploadProgress(100);
      await qc.invalidateQueries({ queryKey: qk.documents });
    } catch (err) {
      onError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
      window.setTimeout(() => {
        setUploadProgress(0);
        setUploadName("");
      }, 800);
    }
  };

  return (
    <aside className="rag-sidebar">
      <div className="rag-sidebar-header">
        <h1>知识库</h1>
        <p>上传 PDF / Word，右侧基于库内文档问答</p>
        <p className="rag-sidebar-tip">
          提示：若上下文不足，可尝试上传相关文档或改写问题关键词。
        </p>
      </div>
      <div className="rag-upload">
        <label className="rag-upload-label">
          <span>{busy ? "上传中…" : "上传文档"}</span>
          <input
            className="rag-file-input"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={busy}
            onChange={onPickFile}
          />
        </label>
        {busy && (
          <div className="rag-upload-status" role="status" aria-live="polite">
            <div className="rag-upload-meta">
              <span className="rag-upload-name">{uploadName}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="rag-upload-track">
              <div
                className="rag-upload-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="rag-doc-list">
        {docsQuery.isLoading && <div className="rag-empty">加载文档列表…</div>}
        {docsQuery.isError && (
          <div className="rag-empty">
            无法加载列表：{getApiErrorMessage(docsQuery.error)}
          </div>
        )}
        {!docsQuery.isLoading && !docsQuery.data?.length && (
          <div className="rag-empty">暂无文档。上传后开始检索与问答。</div>
        )}
        {docsQuery.data?.map((d) => (
          <div key={d.doc_id} className="rag-doc-item">
            <div className="rag-doc-meta">
              <div className="rag-doc-name">{d.filename}</div>
              <div className="rag-doc-chunks">{d.chunk_count} 个片段</div>
            </div>
            <button
              type="button"
              className="rag-icon-btn"
              title="删除"
              disabled={del.isPending}
              onClick={() => {
                if (!window.confirm(`删除「${d.filename}」？`)) return;
                del.mutate(d.doc_id);
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
