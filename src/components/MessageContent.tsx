import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
};

function MessageContentInner({ text }: Props) {
  if (!text.trim()) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="rag-msg-paragraph">{children}</p>,
        h1: ({ children }) => <h4 className="rag-msg-heading">{children}</h4>,
        h2: ({ children }) => <h4 className="rag-msg-heading">{children}</h4>,
        h3: ({ children }) => <h4 className="rag-msg-heading">{children}</h4>,
        h4: ({ children }) => <h4 className="rag-msg-heading">{children}</h4>,
        ul: ({ children }) => <ul className="rag-msg-list">{children}</ul>,
        ol: ({ children }) => <ol className="rag-msg-list">{children}</ol>,
        pre: ({ children }) => <pre className="rag-msg-code">{children}</pre>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export const MessageContent = memo(MessageContentInner);
