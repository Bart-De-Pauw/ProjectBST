export const REPO_URL = "https://github.com/Bart-De-Pauw/ProjectBST";

export type BuildInfo = {
  commit: string;
  builtAt: string;
  environment: string;
};

export function readWebBuildInfo(): BuildInfo {
  return {
    commit: import.meta.env.VITE_GIT_COMMIT ?? "dev",
    builtAt: import.meta.env.VITE_BUILD_TIME ?? "",
    environment: import.meta.env.VITE_APP_ENV ?? "dev",
  };
}

export function shortCommit(commit: string): string {
  if (commit === "unknown" || commit === "dev" || commit.length <= 7) {
    return commit;
  }
  return commit.slice(0, 7);
}

export function formatBuiltAtUtc(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
