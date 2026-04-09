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
        const devices = await navigator.mediaDevices.enumerateDevices();

        const obsCam = devices.find(
          (d) =>
            d.kind === "videoinput" &&
            d.label.toLowerCase().includes("obs")
        );

        stream = await navigator.mediaDevices.getUserMedia({
          video: obsCam ? { deviceId: { exact: obsCam.deviceId } } : true,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setError(null);
      } catch (err: any) {
        setError(err?.message || "Camera error");
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Camera Preview</h2>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-lg"
        style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
      />
    </div>
  );
}
