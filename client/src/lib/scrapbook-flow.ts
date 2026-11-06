export type ScrapbookMode = "photo" | "fullscreen" | "editing" | "scanning";
export type ScrapbookAction = "view" | "close-view" | "edit" | "close-edit" | "scan" | "close-scan";

export function transitionScrapbookMode(mode: ScrapbookMode, action: ScrapbookAction): ScrapbookMode {
  if (action === "view" && mode === "photo") return "fullscreen";
  if (action === "close-view" && mode === "fullscreen") return "photo";
  if (action === "edit" && mode === "photo") return "editing";
  if (action === "close-edit" && mode === "editing") return "photo";
  if (action === "scan" && (mode === "photo" || mode === "editing")) return "scanning";
  if (action === "close-scan" && mode === "scanning") return "photo";
  return mode;
}
