import { useEffect, useRef } from "react";

type GazePoint = {
  x: number;
  y: number;
};

type AttentionHeatmapProps = {
  points: GazePoint[];
  title?: string;
};

export function AttentionHeatmap({ points, title = "Gaze Heatmap" }: AttentionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(0, 0, width, height);

    for (const point of points.slice(-120)) {
      const x = Math.max(0, Math.min(1, point.x)) * width;
      const y = Math.max(0, Math.min(1, point.y)) * height;

      const gradient = ctx.createRadialGradient(x, y, 3, x, y, 34);
      gradient.addColorStop(0, "rgba(14, 165, 233, 0.62)");
      gradient.addColorStop(0.45, "rgba(34, 211, 238, 0.26)");
      gradient.addColorStop(1, "rgba(34, 211, 238, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      <div className="aspect-video overflow-hidden rounded-lg border border-slate-700">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </section>
  );
}
