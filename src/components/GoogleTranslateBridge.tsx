import { useEffect } from "react";

// Wires Google Translate as an invisible translation engine.
// Language is controlled by the `googtrans` cookie: `/en/<target>`.
// Set `localStorage['sp:lang']` and call applyLanguage(...) to switch.

const SUPPORTED = ["en", "pcm", "ig", "yo", "ha"] as const;
// Google Translate uses different codes for some Nigerian languages.
const GTRANS_MAP: Record<string, string> = {
  en: "en",
  pcm: "en", // Pidgin isn't in Google Translate; fall back to English.
  ig: "ig",
  yo: "yo",
  ha: "ha",
};

function setGoogTransCookie(target: string) {
  const value = `/en/${target}`;
  // Set cookie on both the exact host and the parent domain so the
  // Google Translate script picks it up regardless of subdomain.
  const host = window.location.hostname;
  document.cookie = `googtrans=${value};path=/`;
  document.cookie = `googtrans=${value};path=/;domain=${host}`;
  const parts = host.split(".");
  if (parts.length > 1) {
    const parent = "." + parts.slice(-2).join(".");
    document.cookie = `googtrans=${value};path=/;domain=${parent}`;
  }
}

export function applyLanguage(lang: string) {
  const target = GTRANS_MAP[lang] ?? "en";
  try { localStorage.setItem("sp:lang", lang); } catch {}
  if (target === "en") {
    // Clear cookie to restore original text.
    document.cookie = "googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const host = window.location.hostname;
    document.cookie = `googtrans=;path=/;domain=${host};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    const parts = host.split(".");
    if (parts.length > 1) {
      document.cookie = `googtrans=;path=/;domain=.${parts.slice(-2).join(".")};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  } else {
    setGoogTransCookie(target);
  }
  // Google Translate reads the cookie at page load; reload to apply.
  window.location.reload();
}

export function GoogleTranslateBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("google-translate-script")) return;

    const stored = (() => { try { return localStorage.getItem("sp:lang") || "en"; } catch { return "en"; } })();
    const target = GTRANS_MAP[stored] ?? "en";
    // Only load engine if user selected a non-English language.
    if (target === "en") return;

    // Hidden mount point required by Google's widget.
    if (!document.getElementById("google_translate_element")) {
      const div = document.createElement("div");
      div.id = "google_translate_element";
      div.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;";
      document.body.appendChild(div);
    }

    (window as any).googleTranslateElementInit = function () {
      const g = (window as any).google;
      if (!g?.translate?.TranslateElement) return;
      new g.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "ig,yo,ha",
          autoDisplay: false,
          layout: g.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        "google_translate_element",
      );
    };

    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return null;
}

export const SUPPORTED_LANGS = SUPPORTED;
