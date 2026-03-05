export function StatusIndicator({ status, animated = true }) {
  const getColor = () => {
    switch (status) {
      case 'Active':
        return 'bg-green-500';
      case 'Idle':
        return 'bg-yellow-500';
      case 'Offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPulseClass = () => {
    if (!animated) return '';
    switch (status) {
      case 'Active':
        return 'animate-pulse-green';
      case 'Idle':
        return 'animate-pulse-yellow';
      default:
        return '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getColor()} ${getPulseClass()}`} />
      <span className="text-xs font-medium text-gray-300">{status}</span>
    </div>
  );
}
