# Trainerize rehab + conditioning import

`workouts.json` holds Tyrell's 105 shared Trainerize workouts (rehab protocols, conditioning,
stretch/foam-rolling routines), parsed by `src/lib/import/trainerize.ts` on 25 Nov 2026.
Each row: `[name, trainerize_tag, est_minutes, instructions, [[exercise, block, slot, sets, reps, rest_sec, notes], ...]]`.

They were loaded into the **test** project. To load them into **live** at go-live:

1. Run `import.sql` in the live SQL editor (creates a temporary `private.import_tz(jsonb)` function).
2. Run `select private.import_tz('<contents of workouts.json>'::jsonb);` (paste the file; it is ~100 KB).
   Re-running is safe: programs already in the same folder are skipped.
3. Run the `drop function` lines at the bottom of `import.sql`.

Each workout becomes a 1-week, 1-day program in:
Protocols › Injury & rehab › (Ankle & foot, Back & thoracic, Elbow, Hip, Knee, Shoulder, Tendinopathy, Wrist & hand),
Protocols › Recovery, and Conditioning › (Aerobic base, Aerobic power, Alactic power, Intervals & sessions).
Exercises not already in the library are added (79 on the test run) and auto-sorted.
