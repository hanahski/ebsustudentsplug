// Image enhance runs fully client-side now (see src/lib/image-enhance.ts).
// This server function is kept only as a no-op fallback so any lingering
// import doesn't break the build. It never calls AI and needs no API key.
import { createServerFn } from "@tanstack/react-start";

export const enhanceImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { imageDataUrl?: string })
  .handler(async ({ data }) => {
    const url =
      data && typeof (data as any).imageDataUrl === "string"
        ? (data as any).imageDataUrl
        : "";
    return url
      ? { ok: true as const, imageDataUrl: url }
      : { ok: false as const, error: "No image provided" };
  });
