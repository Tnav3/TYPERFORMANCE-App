import { BoardView } from "@/components/CardBoard";
import { BackLink, Heading, Screen } from "@/components/ui";
export default async function P({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const n = ["Jordan L.", "The Hammer", "Mia K.", "Sione T.", "Ava R.", "Kai M.", "Lena P.", "Marcus D.", "Tia W.", "Noah B."];
  const tiers = ["elite", "gold", "gold", "gold", "silver", "silver", "silver", "silver", "bronze", "bronze"];
  const top = n.map((name, i) => ({ rank: i + 1, name, avatar: null, overall: 91 - i * 2 - (i > 4 ? 1 : 0), tier: tiers[i], me: i === 1 }));
  const movers = [
    { rank: 1, name: "Tia W.", avatar: null, gain: 7, overall: 72, tier: "silver", me: false },
    { rank: 2, name: "The Hammer", avatar: null, gain: 5, overall: 89, tier: "gold", me: true },
    { rank: 3, name: "Sione T.", avatar: null, gain: 4, overall: 85, tier: "gold", me: false },
    { rank: 4, name: "Noah B.", avatar: null, gain: 3, overall: 70, tier: "bronze", me: false },
  ];
  return (
    <Screen>
      <BackLink href="/trophies" label="Trophy cabinet" />
      <Heading sub="Ratings from player cards. Only people who opt in are shown.">Card leaderboard</Heading>
      <BoardView board={{ open: true, me_on: true, my_top_pct: 25, top, movers }} movers={b === "movers"} />
    </Screen>
  );
}
