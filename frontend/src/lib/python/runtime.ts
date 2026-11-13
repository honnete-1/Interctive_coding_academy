/**
 * Main-thread client for the Pyodide worker (public/py-worker.js).
 * - One shared worker, lazily started.
 * - Wall-clock timeout: the worker is terminated and recreated, so a runaway program can never freeze the tab.
 */

export interface VarInfo {
  type: string;
  repr: string;
  value?: number | string | boolean | null;
  items?: string[];
  entries?: [string, string][];
}

export interface StackFrame {
  name: string;
  line: number | null;
  vars: Record<string, VarInfo>;
}

export interface TraceEvent {
  event: "line" | "return" | "end" | "error";
  line: number | null;
  func?: string;
  value?: VarInfo;
  stack: StackFrame[];
  out: number; // length of the transcript at this moment
}

export interface PyError {
  type: string;
  message: string;
  line: number | null;
}

export interface RunResult {
  stdout: string; // transcript (prompts + echoed input + printed output)
  printed: string;
  error: PyError | null;
  trace: TraceEvent[];
  steps: number;
  truncated: boolean;
  variables: Record<string, VarInfo>;
  durationMs: number;
}

export type RuntimeStatus = "idle" | "loading" | "ready" | "running" | "failed";

const INDEX_URL = process.env.NEXT_PUBLIC_PYODIDE_URL ?? "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/";
const TIMEOUT_MS = 10_000;
const LOAD_TIMEOUT_MS = 90_000;

type Pending = { resolve: (r: RunResult) => void; reject: (e: Error) => void; started: number; timer: ReturnType<typeof setTimeout> };

class PythonRuntime {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private listeners = new Set<(s: RuntimeStatus) => void>();
  status: RuntimeStatus = "idle";
  lastError: string | null = null;

  subscribe(fn: (s: RuntimeStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: RuntimeStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private spawn() {
    const worker = new Worker("/py-worker.js");
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "result" || msg.type === "fatal") {
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (this.pending.size === 0) this.setStatus("ready");
        if (msg.type === "fatal") p.reject(new Error(msg.message));
        else p.resolve({ ...msg.result, durationMs: Math.round(performance.now() - p.started) });
      }
    };
    this.worker = worker;
    return worker;
  }

  /** Starts downloading Python (≈ several MB the first time; cached by the browser afterwards). */
  load(): Promise<void> {
    if (this.ready) return this.ready;
    this.setStatus("loading");
    const worker = this.spawn();
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Python took too long to load. Check your connection.")), LOAD_TIMEOUT_MS);
      const onMsg = (e: MessageEvent) => {
        if (e.data.type === "ready") {
          clearTimeout(timer);
          worker.removeEventListener("message", onMsg);
          this.setStatus("ready");
          resolve();
        } else if (e.data.type === "fatal") {
          clearTimeout(timer);
          reject(new Error(e.data.message));
        }
      };
      worker.addEventListener("message", onMsg);
      worker.postMessage({ type: "init", indexURL: INDEX_URL });
    }).catch((err: Error) => {
      this.lastError = err.message;
      this.reset();
      this.setStatus("failed");
      throw err;
    });
    return this.ready;
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  async run(code: string, opts: { stdin?: string; trace?: boolean; maxSteps?: number } = {}): Promise<RunResult> {
    await this.load();
    const id = this.nextId++;
    this.setStatus("running");
    return new Promise<RunResult>((resolve, reject) => {
      const started = performance.now();
      const timer = setTimeout(() => {
        // Hard stop: kill the worker. Python reloads (from cache) on the next run.
        this.pending.delete(id);
        this.reset();
        this.setStatus("idle");
        resolve({
          stdout: "",
          printed: "",
          error: { type: "TimeoutError", message: `Your program ran for more than ${TIMEOUT_MS / 1000} seconds and was stopped.`, line: null },
          trace: [],
          steps: 0,
          truncated: false,
          variables: {},
          durationMs: TIMEOUT_MS,
        });
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, started, timer });
      this.worker!.postMessage({ type: "run", id, code, stdin: opts.stdin ?? "", trace: opts.trace ?? false, maxSteps: opts.maxSteps ?? 100000, indexURL: INDEX_URL });
    });
  }
}

export const python = new PythonRuntime();

/** Plain-language explanations for common errors (shown next to Python's real message, never instead of it). */
export const ERROR_GUIDE: Record<string, string> = {
  SyntaxError: "Python couldn't read this line. Look for a missing colon, bracket or quote on or just before it.",
  IndentationError: "The spaces at the start of a line don't line up. Lines inside an if/for/while need the same indentation.",
  NameError: "Python doesn't know this name yet. Check the spelling, and make sure the variable is created before it's used.",
  TypeError: "Two values of incompatible types were combined — for example text + number. Did you forget int(...) around input()?",
  ValueError: "A value had the right type but the wrong content — for example int(\"four\").",
  ZeroDivisionError: "The program divided by zero.",
  EOFError: "The program asked for input, but the Input panel had no more lines. Add one value per line.",
  StepLimitExceeded: "The program ran a very large number of steps and was stopped — usually a loop that never ends.",
  TimeoutError: "The program ran too long and was stopped.",
  IndexError: "The program asked for a list position that doesn't exist.",
  KeyError: "The program looked up a dictionary key that isn't there.",
};
