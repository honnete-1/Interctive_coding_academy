"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => null });

interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  height?: number | string;
  highlightLine?: number | null;
  errorLine?: number | null;
  onRun?: () => void;
  label: string;
}

function useThemeName() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.dataset.theme === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark ? "codeverse-dark" : "codeverse-light";
}

/**
 * Monaco editor with a plain-textarea fallback (slow networks / Monaco CDN blocked).
 * Ctrl/Cmd+Enter runs the program. Tab inserts 4 spaces; Esc then Tab moves focus out (keyboard accessible).
 */
export function CodeEditor({ value, onChange, readOnly, height = 260, highlightLine, errorLine, onRun, label }: Props) {
  const theme = useThemeName();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorations = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => {
    // If Monaco hasn't mounted after 8s (e.g. CDN blocked), fall back to a textarea.
    const t = setTimeout(() => !editorRef.current && setFailed(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const decos: MonacoEditor.IModelDeltaDecoration[] = [];
    if (highlightLine)
      decos.push({ range: new monaco.Range(highlightLine, 1, highlightLine, 1), options: { isWholeLine: true, className: "cv-line-current", glyphMarginClassName: "cv-glyph-current" } });
    if (errorLine)
      decos.push({ range: new monaco.Range(errorLine, 1, errorLine, 1), options: { isWholeLine: true, className: "cv-line-error", glyphMarginClassName: "cv-glyph-error" } });
    decorations.current?.clear();
    decorations.current = ed.createDecorationsCollection(decos);
    if (highlightLine) ed.revealLineInCenterIfOutsideViewport(highlightLine);
  }, [highlightLine, errorLine, mounted]);

  if (failed) {
    return (
      <div>
        <textarea
          aria-label={label}
          className="w-full resize-y rounded-xl border border-line bg-[var(--editor-bg)] p-3 font-mono text-sm leading-6 text-ink"
          style={{ height }}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onRun?.();
            } else if (e.key === "Tab" && !e.shiftKey && !readOnly) {
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: s, selectionEnd: end } = el;
              const next = value.slice(0, s) + "    " + value.slice(end);
              onChange?.(next);
              requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
            }
          }}
        />
        <p className="mt-1 text-xs text-ink-3">Simple editor mode (the full editor couldn&apos;t load). Ctrl+Enter runs your code.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ height }} role="group" aria-label={label}>
      <Monaco
        height="100%"
        language="python"
        value={value}
        theme={theme}
        onChange={(v) => onChange?.(v ?? "")}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("codeverse-light", {
            base: "vs", inherit: true,
            rules: [
              { token: "keyword", foreground: "6d3fc0", fontStyle: "bold" },
              { token: "string", foreground: "0f766e" },
              { token: "number", foreground: "a8660a" },
              { token: "comment", foreground: "6b7489", fontStyle: "italic" },
            ],
            colors: { "editor.background": "#fffdf8", "editorLineNumber.foreground": "#a59a86", "editor.lineHighlightBackground": "#f3ecdd" },
          });
          monaco.editor.defineTheme("codeverse-dark", {
            base: "vs-dark", inherit: true,
            rules: [
              { token: "keyword", foreground: "b69bff", fontStyle: "bold" },
              { token: "string", foreground: "3cc6b5" },
              { token: "number", foreground: "f5b84a" },
              { token: "comment", foreground: "8d98b0", fontStyle: "italic" },
            ],
            colors: { "editor.background": "#111a2e", "editorLineNumber.foreground": "#5a6886", "editor.lineHighlightBackground": "#18243d" },
          });
        }}
        onMount={(ed, monaco) => {
          editorRef.current = ed;
          monacoRef.current = monaco as unknown as typeof import("monaco-editor");
          ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
          setMounted(true);
        }}
        options={{
          readOnly,
          fontSize: 15,
          fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
          lineHeight: 24,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: false,
          glyphMargin: true,
          automaticLayout: true,
          renderLineHighlight: "line",
          padding: { top: 10, bottom: 10 },
          accessibilitySupport: "auto",
          tabFocusMode: false,
          wordWrap: "on",
          ariaLabel: label,
        }}
      />
    </div>
  );
}
