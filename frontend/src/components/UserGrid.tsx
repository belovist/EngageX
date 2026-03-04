import { UserCard } from './UserCard';

interface User {
  id: number;
  name: string;
  status: string;
  score: number;
}

interface UserGridProps {
  users: User[];
}

export function UserGrid({ users }: UserGridProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-sm font-mono text-[#888] uppercase tracking-wider">
          Individual User Status
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
