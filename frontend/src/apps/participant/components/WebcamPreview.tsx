import { useEffect, useRef, useState } from "react";

type WebcamPreviewProps = {
  mirrored?: boolean;
};

export function WebcamPreview({ mirrored = true }: WebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setError(null);
      } catch (err) {
        setError((err as Error).message || "Unable to access webcam");
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Camera Preview</h2>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-rose-600">{error}</div>
        ) : null}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        />
      </div>
    </section>
  );
}
