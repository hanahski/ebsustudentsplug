import { useState, ImgHTMLAttributes } from "react";

interface ShimmerImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
  aspect?: string; // e.g. "16 / 9"
}

/**
 * Image with a shimmering skeleton placeholder that shows until the image is
 * fully decoded/loaded, then fades in. Always uses eager loading (per project rule).
 */
export function ShimmerImage({
  wrapperClassName = "",
  className = "",
  aspect,
  onLoad,
  onError,
  src,
  alt = "",
  style,
  ...rest
}: ShimmerImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={aspect ? { aspectRatio: aspect, ...style } : style}
    >
      {!loaded && !errored && (
        <div
          aria-hidden
          className="absolute inset-0 shimmer-skeleton"
        />
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs">
          Image unavailable
        </div>
      )}
      {src && (
        <img
          {...rest}
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
          onError={(e) => { setErrored(true); onError?.(e); }}
          className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

export default ShimmerImage;
