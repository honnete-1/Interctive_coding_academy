import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe renderer for lesson text: paragraphs, "- " lists, **bold**, *italic*, `code`.
 * It builds React elements (never dangerouslySetInnerHTML), so content can't inject HTML.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else parts.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  // Fenced code blocks first, then paragraphs/lists in the prose between them.
  const segments = text.trim().split(/```[\w-]*\n?([\s\S]*?)```/g);
  return (
    <div className={`prose-cv ${className ?? ""}`}>
      {segments.map((seg, si) =>
        si % 2 === 1 ? (
          <pre key={si} className="my-2 overflow-auto rounded-lg bg-paper-2 p-2 font-mono text-sm">{seg.trimEnd()}</pre>
        ) : (
          <Prose key={si} text={seg} />
        ),
      )}
    </div>
  );
}

function Prose({ text }: { text: string }) {
  if (!text.trim()) return null;
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.trim().slice(2), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && " "}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
