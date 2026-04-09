import { useEffect, useRef } from "react";

type MjpegPlayerProps = {
  src: string;
  className?: string;
  alt?: string;
};

export function MjpegPlayer({ src, className, alt }: MjpegPlayerProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Force reload to prevent caching/tiling issues
    img.src = "";
    const url = `${src}?t=${Date.now()}`;
    img.src = url;

    return () => {
      img.src = "";
    };
  }, [src]);

  return (
    <img
      ref={imgRef}
      alt={alt || "Live feed"}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
