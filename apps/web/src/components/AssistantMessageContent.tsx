import { Fragment, type ReactNode } from "react";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ItalicSegments({ text }: { text: string }): ReactNode {
  const re = /_([^_]+)_/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<em key={k++}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function BoldSegments({ text }: { text: string }): ReactNode {
  const parts = text.split("**");
  if (parts.length === 1) return <ItalicSegments text={text} />;
  return (
    <>
      {parts.map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i}>{seg}</strong>
        ) : (
          <ItalicSegments key={i} text={seg} />
        ),
      )}
    </>
  );
}

function ParagraphBlock({ block }: { block: string }): ReactNode {
  const lines = block.split("\n");
  const bulletLines = lines.filter((l) => /^\s*-\s+/.test(l));
  const onlyBulletsAndBlank = lines.every((l) => /^\s*-\s+/.test(l) || l.trim() === "");
  if (onlyBulletsAndBlank && bulletLines.length > 0) {
    return (
      <ul className="my-1 list-disc space-y-1 pl-5">
        {bulletLines.map((l, i) => (
          <li key={i} className="leading-relaxed">
            <BoldSegments text={l.replace(/^\s*-\s+/, "")} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <BoldSegments text={line} />
        </Fragment>
      ))}
    </p>
  );
}

/** Minimal markdown-style rendering for assistant bubbles: **bold**, _italic_, `-` lists. Input is escaped first. */
export function AssistantMessageContent({ text }: { text: string }): ReactNode {
  const safe = escapeHtml(text);
  const blocks = safe.split(/\n\n+/);
  return (
    <div className="text-sm">
      {blocks.map((block, i) => (
        <Fragment key={i}>
          {i > 0 ? <div className="h-2" aria-hidden /> : null}
          <ParagraphBlock block={block} />
        </Fragment>
      ))}
    </div>
  );
}
