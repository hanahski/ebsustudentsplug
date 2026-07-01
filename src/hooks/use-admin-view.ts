import { useEffect, useState } from "react";

const KEY = "sp:admin-view-as-user";

/** Persistent switch for admins to temporarily browse the site as a normal user. */
export function useAdminView() {
  const [asUser, setAsUser] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setAsUser(e.newValue === "1");
    };
    const onCustom = () => setAsUser(window.localStorage.getItem(KEY) === "1");
    window.addEventListener("storage", onStorage);
    window.addEventListener("sp:admin-view-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sp:admin-view-changed", onCustom);
    };
  }, []);

  const set = (v: boolean) => {
    if (typeof window === "undefined") return;
    if (v) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("sp:admin-view-changed"));
    setAsUser(v);
  };

  return { asUser, setAsUser: set };
}
