export type DeviceType = "ios" | "ipad" | "android" | "desktop" | "unknown";

export function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  // iPadOS 13+ sends MacIntel UA but has touch points
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return "ipad";
  if (/iPad/.test(ua)) return "ipad";
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/.test(ua)) return "desktop";
  return "unknown";
}

export function isRunningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as { standalone?: boolean }).standalone
  );
}
