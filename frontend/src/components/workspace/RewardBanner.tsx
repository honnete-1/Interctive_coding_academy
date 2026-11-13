import { Badge, Icon, MASTERY_LABEL } from "@/components/ui";
import type { Reward } from "@/lib/types";

/** Shown only after the server confirmed a passing submission; numbers come straight from the API. */
export function RewardBanner({ reward }: { reward: Reward }) {
  const xp = reward.xp_awarded.reduce((s, x) => s + x.amount, 0);
  return (
    <div className="animate-pop rounded-2xl border-2 border-good/40 bg-good-soft p-4" role="status">
      <p className="flex items-center gap-2 text-lg font-bold text-good">
        <Icon name="check" /> {reward.first_pass ? "Challenge passed!" : "Passed again — XP was already awarded for this one."}
      </p>
      {xp > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {reward.xp_awarded.map((x) => (
            <li key={x.reason}><b className="font-mono text-gold">+{x.amount} XP</b> · {x.reason}</li>
          ))}
        </ul>
      )}
      {reward.mastery.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reward.mastery.map((m) => (
            <Badge key={m.skill} tone={MASTERY_LABEL[m.level]?.tone ?? "neutral"}>{m.name}: {MASTERY_LABEL[m.level]?.label}</Badge>
          ))}
        </div>
      )}
      {reward.achievements.map((a) => (
        <p key={a.slug} className="mt-3 flex items-center gap-2 rounded-xl bg-card p-2 font-semibold">
          <span className="grid size-9 place-items-center rounded-lg bg-gold-soft text-gold"><Icon name={a.icon} /></span>
          Achievement unlocked: {a.title} <span className="font-mono text-sm text-gold">+{a.xp} XP</span>
        </p>
      ))}
    </div>
  );
}
