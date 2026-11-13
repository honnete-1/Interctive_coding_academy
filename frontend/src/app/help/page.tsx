import Link from "next/link";
import { Logo } from "@/components/layout/AppShell";

export const metadata = { title: "Help" };

const FAQ: [string, string][] = [
  ["Where does my code run?", "When you press Run, your Python runs inside your own browser using Pyodide (Python compiled to WebAssembly), in a background worker with a time limit. When you press Submit, the server runs your code again in an isolated sandbox with hidden tests, so grading can't be faked."],
  ["What's the difference between Check and Submit?", "Check runs only the visible example tests and never affects your score or XP. Submit runs every test, including hidden ones with different inputs, and records an assessment."],
  ["Why didn't I get XP again?", "XP is awarded once per challenge, lesson and achievement. Re-running and re-submitting is always allowed and encouraged, but it doesn't award the same XP twice."],
  ["Do hints lower my score?", "Hints are always available. Opening them lowers only the independence part of the score a little, and solving without any hints earns a +20% XP bonus."],
  ["Is Nova always right?", "No. Nova is an AI companion, and its replies are labelled as AI-generated. Check its suggestions against your tests. Nova won't write complete solutions during practice, and only explains concepts during assessments. If the server has no AI provider configured, Nova says so; authored hints still work."],
  ["What does Code X-Ray show?", "A real recording of your program: before each line runs, Python's own tracer captures every variable, the call stack and the output so far. Recordings stop after 1,500 steps, and external packages can't be imported."],
  ["Are the prices in lessons real?", "No. Moto fares, mobile-money rules, ticket prices and electricity charges are invented for learning and aren't official tariffs."],
  ["How do I use the keyboard?", "Every activity works without a mouse. Ctrl+Enter (Cmd+Enter on a Mac) runs code in the editor. In the code editor, Tab indents; press Esc and then Tab to move focus out of it. Ordering activities use the up and down buttons rather than dragging."],
];

export default function HelpPage() {
  return (
    <div className="canvas min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-extrabold">CodeVerse Help</span>
        </Link>
        <h1 className="text-3xl font-extrabold">Help &amp; documentation</h1>
        <div className="mt-6 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-lg font-bold">{q}</summary>
              <p className="mt-2 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-3">
          Developers: the API schema is at <code>/api/docs</code> (sign-in required). The architecture and security notes are in the repository.
        </p>
      </div>
    </div>
  );
}
