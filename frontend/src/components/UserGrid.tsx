import { useState, useMemo } from 'react';
import { UserCard } from './UserCard';
import { SearchBar } from './SearchBar';
import { ArrowUpDown, Users } from 'lucide-react';

interface User {
  id: number;
  name: string;
  status: string;
  score: number;
}

interface UserGridProps {
  users: User[];
  onUserSelect?: (user: User) => void;
}

type SortField = 'name' | 'score' | 'status';
type SortOrder = 'asc' | 'desc';

export function UserGrid({ users, onUserSelect }: UserGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [users, searchQuery, filterStatus, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const activeUsers = users.filter((u) => u.status === 'Active').length;
  const avgScore = Math.round(users.reduce((sum, u) => sum + u.score, 0) / users.length);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="mb-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-blue-400" />
            <h2 className="text-lg font-bold text-white">User Analytics</h2>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-gray-400">
              <span className="text-green-400 font-bold">{activeUsers}</span> Active
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400 font-bold">{avgScore}%</span> Avg Score
            </div>
            <div className="text-gray-400">
              <span className="text-yellow-400 font-bold">{users.length}</span> Total
            </div>
          </div>
        </div>

        <SearchBar onSearch={setSearchQuery} placeholder="Search users by name..." />

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2">
            <span className="text-sm text-gray-400">Filter:</span>
            {['all', 'Active', 'Idle'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <span className="text-sm text-gray-400">Sort by:</span>
            {(['name', 'score', 'status'] as const).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                  sortField === field
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortField === field && (
                  <ArrowUpDown size={12} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400">No users found matching your criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredAndSortedUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onClick={() => onUserSelect?.(user)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
