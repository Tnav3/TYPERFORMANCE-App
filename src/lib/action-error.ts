// Turn a failed server action call into plain words. Happens when the app updated
// while a page was open (old page calls an action that no longer exists), the
// connection dropped, or a coach in "view as client" tries to save.
export function actionErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/Server Action|failed-to-find|deployment/i.test(m)) return "The app just updated. Reload the page and try again.";
  if (/fetch|network|Load failed/i.test(m)) return "No connection. Check your signal and try again.";
  if (/view|403|Forbidden/i.test(m)) return "You're viewing as a client, so saving is off. Tap Back to coach to make changes.";
  return "Something went wrong. Reload the page and try again.";
}
export const needsReload = (msg: string) => /Reload/.test(msg);
