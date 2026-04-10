import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-8 text-slate-100">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">LAN Client-Server</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">EngageX</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            One laptop runs the admin backend and dashboard. Participant laptops join over the same Wi-Fi using the admin server IP, session ID, and their user ID.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <button
            onClick={() => navigate("/host")}
            className="rounded-3xl border border-sky-500/30 bg-sky-500/10 p-6 text-left transition hover:border-sky-400 hover:bg-sky-500/15"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Admin Laptop</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Open Admin Dashboard</h2>
            <p className="mt-2 text-sm text-slate-300">
              Create the session from a meeting link, expose the backend on the LAN, and watch participant scores flow in.
            </p>
          </button>

          <button
            onClick={() => navigate("/participant")}
            className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-left transition hover:border-emerald-400 hover:bg-emerald-500/15"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Participant Laptop</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Join as Participant</h2>
            <p className="mt-2 text-sm text-slate-300">
              Enter the admin server IP, session ID, and your user ID, then start the local client to send JSON scores.
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}
