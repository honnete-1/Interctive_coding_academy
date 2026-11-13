import clsx from "clsx";
import type { VarInfo } from "@/lib/python/runtime";

const TYPE_TONE: Record<string, string> = {
  int: "text-gold", float: "text-gold", str: "text-teal", bool: "text-violet", list: "text-blue", dict: "text-blue", tuple: "text-blue", NoneType: "text-ink-3",
};

/** Variables as labelled boxes. Changed / new values get a pop animation and a highlight ring. */
export function VariableBoxes({ vars, previous, highlight, emptyText = "No variables yet." }: {
  vars: Record<string, VarInfo>;
  previous?: Record<string, VarInfo>;
  highlight?: string[];
  emptyText?: string;
}) {
  const names = Object.keys(vars);
  if (!names.length) return <p className="text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul className="flex flex-wrap gap-3" aria-label="Variables">
      {names.map((name) => {
        const v = vars[name];
        const prev = previous?.[name];
        const isNew = previous && !prev;
        const changed = prev && prev.repr !== v.repr;
        return (
          <li
            key={`${name}-${v.repr}`}
            className={clsx(
              "min-w-[92px] rounded-xl border-2 bg-card px-3 pb-2 pt-1.5 shadow-card",
              isNew || changed ? "animate-pop border-gold" : highlight?.includes(name) ? "border-teal/50" : "border-line",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-ink-2">{name}</span>
              <span className={clsx("font-mono text-[0.65rem] uppercase", TYPE_TONE[v.type] ?? "text-ink-3")}>{v.type}</span>
            </div>
            {v.items ? (
              <div className="mt-1 flex flex-wrap gap-1 font-mono text-sm">
                {v.items.length === 0 && <span className="text-ink-3">(empty)</span>}
                {v.items.map((it, i) => (
                  <span key={i} className="rounded-md border border-line bg-paper-2 px-1.5">
                    <span className="mr-1 text-[0.6rem] text-ink-3">{i}</span>
                    {it}
                  </span>
                ))}
              </div>
            ) : v.entries ? (
              <div className="mt-1 space-y-0.5 font-mono text-sm">
                {v.entries.map(([k, val]) => (
                  <div key={k}>
                    <span className="text-ink-3">{k}:</span> {val}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-0.5 break-all font-mono text-lg font-semibold">{v.repr}</div>
            )}
            {changed && <div className="font-mono text-[0.7rem] text-ink-3">was {prev!.repr}</div>}
          </li>
        );
      })}
    </ul>
  );
}
