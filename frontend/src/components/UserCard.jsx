import { ProgressBar } from './ProgressBar';
import { StatusIndicator } from './StatusIndicator';
import { TrendIndicator } from './TrendIndicator';

export function UserCard({ user, onClick }) {

  const trend = Math.floor(Math.random() * 20) - 10;

  // CARD BORDER COLOR
  const getBorderColor = () => {
    if (user.score >= 70) return "border-green-400";
    if (user.score >= 40) return "border-yellow-400";
    return "border-red-400";
  };

  // PEAK/AVG BACKGROUND COLOR
  const getBoxBg = () => {
    if (user.score >= 70) return "bg-green-500/10";
    if (user.score >= 40) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const borderColor = getBorderColor();
  const boxBg = getBoxBg();

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border ${borderColor} rounded-lg p-4 transition-all duration-300 cursor-pointer hover:scale-[1.02]`}
    >

      <div className="space-y-4">

        {/* HEADER */}

        <div className="flex items-start justify-between">

          <div>
            <p className="text-sm font-semibold text-white">
              {user.name}
            </p>

            <StatusIndicator status={user.status} animated />
          </div>

          <div className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-400">
            {user.score}%
          </div>

        </div>


        {/* PROGRESS */}

        <div className="space-y-3">

          <ProgressBar
            value={user.score}
            max={100}
            animated
          />


          {/* TREND */}

          <div className="flex items-center justify-between">

            <span className="text-xs text-gray-400">
              Trend
            </span>

            <TrendIndicator value={trend} />

          </div>


          {/* PEAK + AVG */}

          <div className="grid grid-cols-2 gap-2 text-xs">

            <div
              className={`border border-gray-600 rounded-md p-2 ${boxBg}`}
            >
              <span className="text-gray-400">
                Peak
              </span>

              <p className="font-semibold text-white">
                {user.score + Math.floor(Math.random() * 20)}%
              </p>
            </div>


            <div
              className={`border border-gray-600 rounded-md p-2 ${boxBg}`}
            >
              <span className="text-gray-400">
                Avg
              </span>

              <p className="font-semibold text-white">
                {Math.floor(user.score * 0.95)}%
              </p>
            </div>

          </div>

        </div>


        {/* BUTTON */}

        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-semibold transition-colors"
        >
          View Details
        </button>

      </div>

    </div>
  );
}