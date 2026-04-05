import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl text-center">

        {/* Title */}
        <h1 className="text-3xl font-semibold text-white">EngageX</h1>
        <p className="mt-2 text-sm text-slate-400">
          AI-powered Attention Monitoring System
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-4">

          <button
            onClick={() => navigate("/participant")}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Join as Participant
          </button>

          <button
            onClick={() => navigate("/host")}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Open Admin Dashboard
          </button>

        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-slate-500">
          Ensure backend services are running before joining.
        </p>

      </div>
    </main>
  );
}