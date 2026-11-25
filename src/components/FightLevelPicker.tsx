// "I compete as: Amateur / Pro" toggle. Sets the default for new fights and the player card record.
import { setFightLevel } from "@/app/fights/actions";
import { LEVEL_LABEL, type FightLevel } from "@/lib/fights";

export function FightLevelPicker({ level, athleteId, next, who = "I compete as", readOnly }: { level: FightLevel | null; athleteId?: string; next: string; who?: string; readOnly?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3">
      <span className="text-sm font-bold">{who}</span>
      <div className="flex gap-1.5">
        {(["amateur", "pro"] as const).map((l) => (
          <form key={l} action={setFightLevel}>
            {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="level" value={l} />
            <button
              disabled={readOnly}
              aria-pressed={level === l}
              className={`min-h-10 rounded-xl border px-4 text-sm font-extrabold uppercase ${level === l ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted"}`}
            >
              {LEVEL_LABEL[l]}
            </button>
          </form>
        ))}
      </div>
      {!level && <span className="text-xs text-muted">Pick one. Pro and amateur records are kept separate.</span>}
    </div>
  );
}
