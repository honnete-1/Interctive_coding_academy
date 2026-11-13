"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Icon, PageLoader, TextField } from "@/components/ui";
import { api, ApiError, fieldErrors } from "@/lib/api";
import type { PortfolioEntry } from "@/lib/types";

function EntryCard({ entry, onSaved }: { entry: PortfolioEntry; onSaved: (e: PortfolioEntry) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ reflection: entry.reflection, repository_url: entry.repository_url, deployment_url: entry.deployment_url });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      onSaved(await api<PortfolioEntry>(`portfolio/${entry.id}`, { method: "PATCH", body: form }));
      setEditing(false);
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!(e instanceof ApiError)) setErrors({ reflection: "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="article" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{entry.title}</h2>
          <p className="text-sm text-ink-3">Completed {new Date(entry.updated_at).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entry.technologies.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
          <Badge tone="good"><Icon name="check" className="size-3.5" /> {entry.tests_passed}/{entry.tests_total} automated tests</Badge>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-ink-2">{entry.problem}</p>
      {entry.features.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {entry.features.map((f) => <li key={f} className="flex gap-2"><span className="text-teal">◆</span>{f}</li>)}
        </ul>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">View code</summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-paper-2 p-3 font-mono text-sm">{entry.code}</pre>
      </details>

      {editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Reflection: what did you learn, and what would you improve?</span>
            <textarea value={form.reflection} onChange={(e) => setForm({ ...form, reflection: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-line-strong bg-card p-2" />
          </label>
          <TextField label="GitHub repository link (optional)" type="url" value={form.repository_url} onChange={(e) => setForm({ ...form, repository_url: e.target.value })} error={errors.repository_url} placeholder="https://github.com/you/project" />
          <TextField label="Live demo link (optional)" type="url" value={form.deployment_url} onChange={(e) => setForm({ ...form, deployment_url: e.target.value })} error={errors.deployment_url} hint="Only add this if you've deployed it yourself. CodeVerse doesn't deploy projects yet." />
          <div className="flex gap-2">
            <Button onClick={save} loading={busy}>Save</Button>
            <Button tone="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {entry.reflection && <blockquote className="border-l-4 border-violet pl-3 text-ink-2">{entry.reflection}</blockquote>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {entry.repository_url && <a className="font-semibold text-teal underline" href={entry.repository_url} target="_blank" rel="noreferrer noopener">Repository</a>}
            {entry.deployment_url && <a className="font-semibold text-teal underline" href={entry.deployment_url} target="_blank" rel="noreferrer noopener">Live demo (added by you)</a>}
            <Button size="sm" tone="secondary" onClick={() => setEditing(true)}>Edit details</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PortfolioInner() {
  const [entries, setEntries] = useState<PortfolioEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<PortfolioEntry[]>("portfolio").then(setEntries).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your portfolio."));
  }, []);
  useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!entries) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Portfolio</h1>
        <p className="mt-1 max-w-3xl text-ink-2">Projects, transfer challenges and capstones you&apos;ve passed, with the code and test results to prove it. Add a reflection and links to make each one portfolio-ready.</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Your first project is waiting" icon={<Icon name="folder" className="size-8" />} action={<ButtonLink href="/dashboard">Continue learning</ButtonLink>}>
          Pass the Real Fare Calculator in the Moto Fare mission and it will appear here.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onSaved={(n) => setEntries((list) => list!.map((x) => (x.id === n.id ? n : x)))} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <AppShell>
      <PortfolioInner />
    </AppShell>
  );
}
