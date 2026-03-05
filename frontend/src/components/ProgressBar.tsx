interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  animated?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  label, 
  showValue = true,
  animated = true 
}: ProgressBarProps) {
  const percentage = (value / max) * 100;
  const getColor = () => {
    if (percentage >= 80) return 'from-green-500 to-green-400';
    if (percentage >= 60) return 'from-blue-500 to-blue-400';
    if (percentage >= 40) return 'from-yellow-500 to-yellow-400';
    return 'from-red-500 to-red-400';
  };

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-xs text-gray-400">{label}</span>}
          {showValue && <span className="text-xs font-bold text-white">{value}%</span>}
        </div>
      )}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getColor()} ${animated ? 'transition-all duration-300' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
