import { Moon, Sun, Zap, Waves, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: Zap },
    { id: 'ocean', label: 'Ocean', icon: Waves },
    { id: 'purple', label: 'Purple', icon: Sparkles },
  ];

  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-gray-400">Theme:</span>
      <div className="flex gap-1">
        {themes.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={`p-2 rounded transition-all ${
              theme === id ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={id}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
