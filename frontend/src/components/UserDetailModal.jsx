import { X, TrendingUp, Award } from "lucide-react";

export function UserDetailModal({ user, onClose }) {
  if (!user) return null;

  const stats = [
    { label: "Current Score", value: user.score, unit: "/100" },
    { label: "Session Duration", value: 45, unit: "mins" },
    { label: "Attention Rate", value: 87, unit: "%" },
    { label: "Peak Score", value: 95, unit: "/100" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">

      {/* Modal */}

      <div
        className="
        bg-[#0B1220]
        border border-blue-500/30
        rounded-xl
        p-8
        max-w-md
        w-full
        mx-4
        "
      >

        {/* Header */}

        <div className="flex items-start justify-between mb-6">

          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {user.name}
            </h2>

            <p
              className={`text-sm font-semibold ${
                user.status === "Active"
                  ? "text-green-400"
                  : "text-yellow-400"
              }`}
            >
              {user.status}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={22} />
          </button>

        </div>


        {/* Stats */}

        <div className="grid grid-cols-2 gap-4 mb-6">

          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="
              bg-[#111827]
              border border-gray-700
              rounded-lg
              p-4
              "
            >

              <p className="text-gray-400 text-xs mb-2">
                {stat.label}
              </p>

              <p className="text-lg font-semibold text-white">
                {stat.value}
                <span className="text-xs text-gray-400 ml-1">
                  {stat.unit}
                </span>
              </p>

            </div>
          ))}

        </div>


        {/* Performance */}

        <div
          className="
          bg-[#111827]
          border border-gray-700
          rounded-lg
          p-4
          mb-6
          "
        >

          <p className="text-sm text-gray-400 mb-3">
            Performance
          </p>

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <TrendingUp size={18} />
              +5%
            </div>

            <Award className="text-blue-400" size={20} />

          </div>

        </div>


        {/* Close Button */}

        <button
          onClick={onClose}
          className="
          w-full
          border border-blue-500
          text-blue-400
          py-2
          rounded-lg
          font-semibold
          transition
          hover:bg-blue-500/10
          "
        >
          Close
        </button>

      </div>
    </div>
  );
}