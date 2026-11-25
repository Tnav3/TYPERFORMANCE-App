// Built-in loading schemes, written in the coach's text format (see schemes.ts).
// Seeded into the database by migration 093; also unit-tested so every one parses.
export const SCHEME_PRESETS: { name: string; description: string; text: string; sort: number }[] = [
  {
    name: "5x5 building (RPE)",
    description: "Five sets of five. Effort climbs each week, then a lighter week 4.",
    text: "5@7, 5@7, 5@7, 5@7, 5@7\n5@7.5, 5@7.5, 5@7.5, 5@7.5, 5@7.5\n5@8, 5@8, 5@8, 5@8, 5@8\n5@6, 5@6, 5@6",
    sort: 20,
  },
  {
    name: "Linear % 4x6 > 4x5 > 4x4 + deload",
    description: "Classic strength block off a 1RM. Reps drop as load climbs; week 4 lighter.",
    text: "6@70%, 6@70%, 6@70%, 6@70%\n5@75%, 5@75%, 5@75%, 5@75%\n4@80%, 4@80%, 4@80%, 4@80%\n5@60%, 5@60%, 5@60%",
    sort: 21,
  },
  {
    name: "Heavy triples 5x3 (%)",
    description: "Max strength. Small jumps each week, deload in week 4.",
    text: "3@80%, 3@80%, 3@80%, 3@80%, 3@80%\n3@82.5%, 3@82.5%, 3@82.5%, 3@82.5%, 3@82.5%\n3@85%, 3@85%, 3@85%, 3@85%, 3@85%\n3@70%, 3@70%, 3@70%",
    sort: 22,
  },
  {
    name: "Top set + back-offs",
    description: "One heavy top set, then three back-off sets of five. Top set gets heavier each week.",
    text: "3@85%, 5@75%, 5@75%, 5@75%\n2@88%, 5@77.5%, 5@77.5%, 5@77.5%\n1@92%, 5@80%, 5@80%, 5@80%",
    sort: 23,
  },
  {
    name: "Strength-speed 6x2 (70-75%)",
    description: "Moderate load moved as fast as possible. Great in fight camp.",
    text: "2@70%, 2@70%, 2@70%, 2@70%, 2@70%, 2@70%\n2@72.5%, 2@72.5%, 2@72.5%, 2@72.5%, 2@72.5%, 2@72.5%\n2@75%, 2@75%, 2@75%, 2@75%, 2@75%, 2@75%",
    sort: 24,
  },
  {
    name: "Speed-strength 5x3 (30-40%)",
    description: "Light, fast and explosive: loaded jumps, trap bar jumps, speed pulls.",
    text: "3@30%, 3@30%, 3@30%, 3@30%, 3@30%\n3@35%, 3@35%, 3@35%, 3@35%, 3@35%\n3@40%, 3@40%, 3@40%, 3@40%, 3@40%",
    sort: 25,
  },
  {
    name: "Hypertrophy 4x10 > 4x8 > 4x6",
    description: "Off-season size block. Reps drop and effort builds over three weeks.",
    text: "10@7, 10@7, 10@7, 10@7\n8@7.5, 8@7.5, 8@7.5, 8@7.5\n6@8, 6@8, 6@8, 6@8",
    sort: 26,
  },
  {
    name: "Strength endurance 3x15 > 3x12 > 3x10",
    description: "Accessories, rehab and general prep. Easy effort that slowly builds.",
    text: "15@6, 15@6, 15@6\n12@6.5, 12@6.5, 12@6.5\n10@7, 10@7, 10@7",
    sort: 27,
  },
  {
    name: "Descending pyramid 4/6/8/10",
    description: "Heaviest set first while fresh, then lighter sets for more reps.",
    text: "4@8.5, 6@8, 8@7.5, 10@7",
    sort: 28,
  },
  {
    name: "RPE wave 5/3/1 (no max needed)",
    description: "The 5/3/1 feel by effort instead of percentages. Week 3 is lighter.",
    text: "5@7, 3@8, 1@9\n5@7.5, 3@8.5, 1@9.5\n5@6, 5@6, 5@6",
    sort: 29,
  },
  {
    name: "Deload week",
    description: "One easy week: fewer sets, lower effort. Use before a test or a fight.",
    text: "5@6, 5@6, 5@6",
    sort: 40,
  },
];
