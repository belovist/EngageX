import { Search, X } from 'lucide-react';
import { useState } from 'react';

export function SearchBar({ onSearch, placeholder = 'Search users...' }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="relative">

      <Search
        className="absolute left-3 top-3 text-gray-400"
        size={18}
      />

      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2
          bg-white/[0.04]
          border border-white/10
          backdrop-blur-lg
          rounded-lg
          text-white
          placeholder-gray-500
          focus:outline-none
          focus:border-blue-400
          focus:ring-2
          focus:ring-blue-500/20
          transition-all duration-300
        "
      />

      {query && (
        <button
          onClick={handleClear}
          className="
            absolute right-3 top-3
            text-gray-400
            hover:text-white
            transition-all
          "
        >
          <X size={18} />
        </button>
      )}

    </div>
  );
}