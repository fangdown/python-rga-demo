import { memo, useMemo, type ReactNode } from "react";

type Props = {
  text: string;
};

function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return <code key={idx}>{part.slice(1, -1)}</code>;
    }
    return <span key={idx}>{part}</span>;
  });
}

function MessageContentInner({ text }: Props) {
  const blocks = useMemo(() => {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const built: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      if (trimmed.startsWith("```")) {
        const codeLines: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        built.push(
          <pre key={`code-${i}`} className="rag-msg-code">
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        continue;
      }

      if (/^#{1,3}\s+/.test(trimmed)) {
        const content = trimmed.replace(/^#{1,3}\s+/, "");
        built.push(
          <h4 key={`h-${i}`} className="rag-msg-heading">
            {renderInline(content)}
          </h4>,
        );
        i += 1;
        continue;
      }

      if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const items: string[] = [];
        while (
          i < lines.length &&
          (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
        ) {
          items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
          i += 1;
        }
        built.push(
          <ul key={`ul-${i}`} className="rag-msg-list">
            {items.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ul>,
        );
        continue;
      }

      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        if (
          /^#{1,3}\s+/.test(lines[i].trim()) ||
          /^\s*[-*]\s+/.test(lines[i]) ||
          /^\s*\d+\.\s+/.test(lines[i]) ||
          lines[i].trim().startsWith("```")
        ) {
          break;
        }
        paraLines.push(lines[i]);
        i += 1;
      }

      built.push(
        <p key={`p-${i}`} className="rag-msg-paragraph">
          {renderInline(paraLines.join("\n"))}
        </p>,
      );
    }

    return built;
  }, [text]);

  if (!blocks.length) return null;
  return <div className="rag-msg-rich">{blocks}</div>;
}

export const MessageContent = memo(MessageContentInner);
