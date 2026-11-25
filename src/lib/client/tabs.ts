// Which client tabs show in the bottom bar. At most 5 fit a phone comfortably:
// when Nutrition is on as well, Progress moves into More.
export interface TabFlags {
  train: boolean;
  chat: boolean;
  progress: boolean;
  food: string | null;
}

export type TabKey = "home" | "train" | "chat" | "food" | "progress" | "more";

export function visibleTabs(f: TabFlags): TabKey[] {
  const tabs: TabKey[] = ["home"];
  if (f.train) tabs.push("train");
  if (f.chat) tabs.push("chat");
  if (f.food) tabs.push("food");
  if (f.progress) tabs.push("progress");
  tabs.push("more");
  if (tabs.length > 5) tabs.splice(tabs.indexOf("progress"), 1);
  return tabs;
}
