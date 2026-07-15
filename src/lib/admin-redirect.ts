const ADMIN_PANEL_URL_KEY = "studentsplug:admin-panel-url";

export const LEGACY_ADMIN_PATH = "/admin";

function cleanAdminUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https:\/\//i.test(url)) return url;
  return "";
}

export function getAdminRedirectUrl() {
  const envUrl = getConfiguredAdminRedirectUrl();
  if (envUrl) return envUrl;

  if (typeof window === "undefined") return LEGACY_ADMIN_PATH;

  try {
    return cleanAdminUrl(window.localStorage.getItem(ADMIN_PANEL_URL_KEY)) || LEGACY_ADMIN_PATH;
  } catch {
    return LEGACY_ADMIN_PATH;
  }
}

export function getConfiguredAdminRedirectUrl() {
  return cleanAdminUrl(import.meta.env.VITE_ADMIN_PANEL_URL as string | undefined);
}

export function goToAdminPanel() {
  if (typeof window === "undefined") return;
  window.location.assign(getAdminRedirectUrl());
}