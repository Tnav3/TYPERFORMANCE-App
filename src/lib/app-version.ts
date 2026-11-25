// Shown on feedback reports and the What's new page.
import pkg from "../../package.json";
export const APP_VERSION = `${pkg.version}${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ? `+${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`;
