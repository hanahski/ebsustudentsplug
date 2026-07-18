// Contenteditable story editor with drag & drop / paste image support.
// Images are uploaded to the `post-images` bucket and inserted at the drop
// (or caret) position so the writer sees the true published layout while
// composing — no [img:URL] tokens visible in the editing surface.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { toast } from "sonner";

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  userId: string | undefined;
  placeholder?: string;
  minHeight?: number;
  invalid?: boolean;
  ariaDescribedBy?: string;
}

const IMG_STYLE =
  'max-width:100%;border-radius:12px;display:block;margin:12px 0;';

function buildImgHtml(url: string) {
  return `<p><img src="${url}" alt="" loading="eager" style="${IMG_STYLE}" /></p><p><br/></p>`;
}

export function StoryEditor({
  value,
  onChange,
  userId,
  placeholder,
  minHeight = 260,
  invalid,
  ariaDescribedBy,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastEmitted = useRef<string>("");
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Sync external -> DOM only when the value truly differs (avoid caret jumps).
  useEffect(() => {
    if (!ref.current) return;
    if (value !== lastEmitted.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || "";
      lastEmitted.current = value || "";
    }
  }, [value]);

  const emit = useCallback(() => {
    const html = sanitizeHtml(ref.current?.innerHTML ?? "");
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  const insertHtmlAtCaret = useCallback((html: string) => {
    ref.current?.focus();
    // Try modern approach first.
    // execCommand still works reliably in Chromium/WebKit for this use case.
    const ok = document.execCommand("insertHTML", false, html);
    if (!ok && ref.current) {
      ref.current.insertAdjacentHTML("beforeend", html);
    }
    emit();
  }, [emit]);

  const placeCaretAt = (clientX: number, clientY: number) => {
    const doc = document as any;
    let range: Range | null = null;
    if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(clientX, clientY);
      if (p) {
        range = document.createRange();
        range.setStart(p.offsetNode, p.offset);
        range.collapse(true);
      }
    } else if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(clientX, clientY);
    }
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      ref.current?.focus();
    }
  };

  const uploadOne = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) { toast.error("Sign in to add images"); return null; }
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return null; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return null; }
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const safe = ext.replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-inline.${safe}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl;
  }, [userId]);

  const handleFiles = useCallback(async (files: File[], atPoint?: { x: number; y: number }) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    if (atPoint) placeCaretAt(atPoint.x, atPoint.y);
    for (const f of imgs) {
      setUploading((n) => n + 1);
      try {
        const url = await uploadOne(f);
        if (url) insertHtmlAtCaret(buildImgHtml(url));
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
  }, [uploadOne, insertHtmlAtCaret]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) handleFiles(files, { x: e.clientX, y: e.clientY });
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  return (
    <div
      className={`relative rounded-xl border bg-background transition ${
        dragOver ? "border-primary ring-2 ring-primary/30" : invalid ? "border-destructive" : "border-input"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        data-placeholder={placeholder}
        className="prose prose-sm dark:prose-invert max-w-none px-4 py-3 outline-none text-[15px] leading-relaxed [&[data-placeholder]:empty::before]:content-[attr(data-placeholder)] [&[data-placeholder]:empty::before]:text-muted-foreground [&_img]:my-3 [&_img]:rounded-xl"
        style={{ minHeight }}
      />

      {/* Overlay hint while dragging a file over the editor */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-primary/5 border-2 border-dashed border-primary flex items-center justify-center">
          <div className="text-sm font-bold text-primary flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Drop image here
          </div>
        </div>
      )}

      {/* Bottom action row */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/30 rounded-b-xl">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading > 0}
          className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50"
        >
          {uploading > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
          {uploading > 0 ? `Uploading ${uploading}…` : "Add image"}
        </button>
        <span className="text-[10px] text-muted-foreground">
          Drag & drop, paste, or tap Add image
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) handleFiles(files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
