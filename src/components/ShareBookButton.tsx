import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://ebsustudentsplug.fun";

export function bookShareUrl(id: string) {
  return `${SITE}/books/read/${id}`;
}

/**
 * Share any library book outside the site. Uses the native share sheet on
 * mobile (WhatsApp, X, Telegram…) and falls back to copying the link.
 * The shared URL is server-rendered with og:title / og:description /
 * og:image, so the book cover shows up in the preview card.
 */
export function ShareBookButton({
  id,
  title,
  author,
  variant = "outline",
  size = "sm",
  className,
  label = "Share",
}: {
  id: string;
  title: string;
  author?: string | null;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "icon" | "default";
  className?: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = bookShareUrl(id);
    const text = `${title}${author ? ` by ${author}` : ""} — read it free on StudentsPlug Library`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
      toast.success("Book link copied — paste it anywhere");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={share}>
      {done ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      {size !== "icon" && <span className="ml-1.5">{done ? "Copied" : label}</span>}
    </Button>
  );
}
