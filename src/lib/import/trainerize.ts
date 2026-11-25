// Parse a Trainerize workout page (text as shown in the browser) into our program items.
// Used once to import the coach's rehab and conditioning templates. Pure, unit-tested.
export interface TzItem {
  exercise: string;
  block: string; // A, B, C…
  slot: number;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  notes: string | null;
}
export interface TzWorkout {
  name: string;
  tag: string | null;
  minutes: number | null;
  instructions: string | null;
  items: TzItem[];
}

const RX = /^(\d{1,2}\s*sets?\s*x\s*.+|\d+(?:\s*[-–]\s*\d+)?\s*(?:reps?|e\/s|each|sec|secs|seconds|s|min|mins|minutes|cal|m|km|x\b).*|\d+(?:\s*[-–]\s*\d+)?(?:\s+[-–]\s.*|\s+on\s.*|\s*))$/i;
const GROUP = /^(superset|circuit|tri-?set|giant set)\s+of\s+(\d{1,2})\s+sets?$/i;
const REST_BETWEEN = /^rest\s+(\d+(?:\.\d+)?)\s*(sec|secs|seconds|s|min|mins|minutes|m)\s+between\s+sets$/i;
const REST_FOR = /^rest\s+for\s+(\d+(?:\.\d+)?)\s*(sec|secs|seconds|s|min|mins|minutes|m)$/i;
const SKIP = /^(repeat new set|regular workout|interval workout|equipment|instructions)$/i;

const secs = (n: string, u: string) => Math.min(1800, Math.round(Number(n) * (/^m/i.test(u) ? 60 : 1)));

function unit(r: string) {
  return r
    .replace(/\s*(seconds|secs|sec)\b/i, "s")
    .replace(/\s*(minutes|mins|min)\b/i, " min")
    .replace(/\s+each\b/i, "")
    .replace(/\s*reps?\b/i, "")
    .replace(/\s*[-–]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** "3 sets x 10-15 - Extend as far as…" → sets 3, reps "10-15", note. "10-15 reps - Controlled lower" → reps + note. */
export function parseRx(line: string): { sets: number | null; reps: string | null; notes: string | null } {
  let s = line.trim();
  let sets: number | null = null;
  const m = s.match(/^(\d{1,2})\s*sets?\s*x\s*/i);
  if (m) {
    sets = Math.min(20, Math.max(1, Number(m[1])));
    s = s.slice(m[0].length);
  }
  // reps part ends at " - " or ", " (rest is a note)
  const cut = s.search(/\s[-–]\s?|,\s|\s-(?=[A-Za-z])/);
  const head = (cut >= 0 ? s.slice(0, cut) : s).trim();
  const tail = cut >= 0 ? s.slice(cut).replace(/^\s*[-–,]\s*/, "").trim() : "";
  let reps = unit(head);
  let note = tail;
  // "10-15 on injured side." → reps 10-15, note "On injured side."
  const extra = head.match(/^(\d+(?:\s*[-–]\s*\d+)?(?:\s*(?:e\/s|reps?|each))?)\s+((?:on|per|with|each side|alternating)\b.*)$/i);
  if (extra) {
    reps = unit(extra[1]);
    note = [extra[2].charAt(0).toUpperCase() + extra[2].slice(1), tail].filter(Boolean).join(" ");
  }
  if (reps.length > 20) {
    note = [head, tail].filter(Boolean).join(" - ");
    reps = reps.slice(0, 20);
  }
  return { sets, reps: reps || null, notes: note || null };
}

export function parseWorkout(raw: string): TzWorkout {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0];
  let i = 1;
  while (lines[i] === name) i++;
  let tag: string | null = null;
  if (lines[i] && !/^(regular workout|interval workout|created by)/i.test(lines[i])) tag = lines[i++];
  let minutes: number | null = null;
  const est = lines.findIndex((l) => /^est\.\s*\d+\s*minutes?/i.test(l));
  if (est >= 0) minutes = Number(lines[est].match(/\d+/)![0]);

  const isEntry = (k: number) => k + 1 < lines.length && !RX.test(lines[k]) && !GROUP.test(lines[k]) && !REST_BETWEEN.test(lines[k]) && !REST_FOR.test(lines[k]) && RX.test(lines[k + 1]);
  const first = lines.findIndex((_, k) => k > i && isEntry(k));
  const insStart = lines.indexOf("Instructions");
  const instructions = insStart >= 0 && first > insStart ? lines.slice(insStart + 1, first).join("\n") : null;
  // a "Superset of 3 sets" line right before the first entry belongs to the list, not the instructions
  let instr = instructions;
  let k = first;
  if (instr && first > 0 && GROUP.test(lines[first - 1])) {
    instr = lines.slice(insStart + 1, first - 1).join("\n") || null;
    k = first - 1;
  }

  const items: TzItem[] = [];
  let blockNo = -1;
  let groupSets: number | null = null;
  let inGroup = false;
  const letter = (n: number) => String.fromCharCode(65 + Math.min(25, n));
  while (k >= 0 && k < lines.length) {
    const l = lines[k];
    let m: RegExpMatchArray | null;
    if ((m = l.match(GROUP))) {
      inGroup = true;
      groupSets = Number(m[2]);
      blockNo++;
      k++;
      continue;
    }
    if ((m = l.match(REST_BETWEEN))) {
      if (items.length) items[items.length - 1].rest_sec = secs(m[1], m[2]);
      k++;
      continue;
    }
    if ((m = l.match(REST_FOR))) {
      // superset: rest after a round = rest on the group's last line. Straight sets: a break before the next exercise.
      const last = items[items.length - 1];
      if (last && inGroup) last.rest_sec = secs(m[1], m[2]);
      else if (last) last.notes = [last.notes, `Then rest ${m[1]} ${/^m/i.test(m[2]) ? "min" : "sec"} before the next exercise.`].filter(Boolean).join(" ");
      inGroup = false;
      groupSets = null;
      k++;
      continue;
    }
    if (SKIP.test(l)) {
      k++;
      continue;
    }
    if (isEntry(k)) {
      const rx = parseRx(lines[k + 1]);
      if (!inGroup) blockNo++;
      const block = letter(blockNo);
      items.push({
        exercise: l,
        block,
        slot: items.filter((x) => x.block === block).length + 1,
        sets: rx.sets ?? (inGroup ? groupSets : null),
        reps: rx.reps,
        rest_sec: null,
        notes: rx.notes,
      });
      k += 2;
      continue;
    }
    break; // exercise descriptions start here
  }
  return { name, tag, minutes, instructions: instr, items };
}
