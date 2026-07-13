const ADMIN_PANEL_URL_KEY = "studentsplug:admin-panel-url";

export const LEGACY_ADMIN_PATH = "/admin-local";

function cleanAdminUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https:\/\//i.test(url)) return url;
  return "";
}

export function getAdminRedirectUrl() {
  const envUrl = cleanAdminUrl(import.meta.env.VITE_ADMIN_PANEL_URL as string | undefined);
  if (envUrl) return envUrl;

  if (typeof window === "undefined") return LEGACY_ADMIN_PATH;

  try {
    return cleanAdminUrl(window.localStorage.getItem(ADMIN_PANEL_URL_KEY)) || LEGACY_ADMIN_PATH;
  } catch {
    return LEGACY_ADMIN_PATH;
  }
}

export function goToAdminPanel() {
  if (typeof window === "undefined") return;
  window.location.assign(getAdminRedirectUrl());
}