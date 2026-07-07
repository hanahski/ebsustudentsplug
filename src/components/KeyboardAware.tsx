import { useEffect } from "react";

/**
 * Global keyboard-aware behavior for mobile:
 * - Detects when the on-screen keyboard opens (via visualViewport height shrink
 *   OR focus on a text-entry element) and toggles `body.keyboard-open`, which
 *   CSS uses to hide the fixed bottom nav so it stops "crumbling" the page.
 * - Scrolls the focused input into view above the keyboard so users never
 *   have to scroll manually to see what they're typing.
 */
export function KeyboardAware() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const body = document.body;

    const isTextEntry = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const t = (el as HTMLInputElement).type;
        return !["button", "submit", "reset", "checkbox", "radio", "range", "file", "color", "image"].includes(t);
      }
      return false;
    };

    const setOpen = (open: boolean) => {
      body.classList.toggle("keyboard-open", open);
    };

    const scrollIntoView = (el: HTMLElement) => {
      // Delay so keyboard has time to appear and viewport to resize.
      window.setTimeout(() => {
        try {
          const rect = el.getBoundingClientRect();
          const vv = window.visualViewport;
          const vh = vv?.height ?? window.innerHeight;
          const targetTop = vh * 0.35; // put focused field in upper third
          const delta = rect.top - targetTop;
          if (Math.abs(delta) > 40) {
            window.scrollBy({ top: delta, behavior: "smooth" });
          }
        } catch {}
      }, 250);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextEntry(e.target)) return;
      setOpen(true);
      scrollIntoView(e.target as HTMLElement);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!isTextEntry(e.target)) return;
      // Small delay so tap between fields doesn't flicker the bottom nav.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!isTextEntry(active)) setOpen(false);
      }, 120);
    };

    // Also react to real visualViewport changes (Android quirks).
    const baseHeight = window.innerHeight;
    const onViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const shrink = baseHeight - vv.height;
      if (shrink > 150) setOpen(true);
      else if (!isTextEntry(document.activeElement)) setOpen(false);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewport);
      setOpen(false);
    };
  }, []);

  return null;
}
