"use client";

import { useCallback, useEffect, useState } from "react";
import { python, type RunResult, type RuntimeStatus } from "@/lib/python/runtime";

/** React binding for the shared Pyodide runtime. Starts loading Python as soon as a component needs it. */
export function usePython({ preload = true } = {}) {
  const [status, setStatus] = useState<RuntimeStatus>(python.status);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = python.subscribe(setStatus);
    if (preload) python.load().catch((e: Error) => setLoadError(e.message));
    return () => {
      unsub();
    };
  }, [preload]);

  const run = useCallback(async (code: string, opts?: { stdin?: string; trace?: boolean; maxSteps?: number }): Promise<RunResult> => {
    try {
      setLoadError(null);
      return await python.run(code, opts);
    } catch (e) {
      const message = (e as Error).message;
      setLoadError(message);
      return {
        stdout: "", printed: "", trace: [], steps: 0, truncated: false, variables: {}, durationMs: 0,
        error: { type: "RuntimeUnavailable", message: `Python couldn't run in this browser: ${message}`, line: null },
      };
    }
  }, []);

  return { run, status, loadError };
}
