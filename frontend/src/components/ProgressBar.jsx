export function ProgressBar({ value, max = 100, label, showValue = true, animated = true }) {

  const percentage = (value / max) * 100;

  const getColor = () => {
    if (percentage >= 80) return 'from-blue-500 to-indigo-500';
    if (percentage >= 60) return 'from-blue-500 to-purple-500';
    if (percentage >= 40) return 'from-indigo-500 to-purple-500';
    return 'from-slate-500 to-slate-400';
  };

  return (

    <div className="w-full">

      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">

          {label && (
            <span className="text-xs text-gray-400">
              {label}
            </span>
          )}

          {showValue && (
            <span className="text-xs font-semibold text-blue-300">
              {value}%
            </span>
          )}

        </div>
      )}

      {/* Track */}
      <div className="h-2 bg-white/[0.06] border border-white/5 rounded-full overflow-hidden">

        {/* Fill */}
        <div
          className={`h-full bg-gradient-to-r ${getColor()} ${
            animated ? 'transition-all duration-500 ease-out' : ''
          } shadow-[0_0_6px_rgba(109,140,255,0.4)]`}
          style={{ width: `${percentage}%` }}
        />

      </div>

    </div>
  );
}