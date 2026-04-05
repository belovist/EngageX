import { useMemo, useState } from "react";
import { apiUrl } from "../../../config";

type WebcamPreviewProps = {
  mirrored?: boolean;
};

export function WebcamPreview({ mirrored = true }: WebcamPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => apiUrl("/video_feed"), []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Pipeline Preview</h2>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-rose-600">{error}</div>
        ) : null}
        <img
          src={previewUrl}
          alt="Live pipeline preview"
          className="h-full w-full object-cover"
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
          onLoad={() => setError(null)}
          onError={() => setError("Preview is unavailable until the backend and participant client are both streaming.")}
        />
      </div>
    </section>
  );
}
