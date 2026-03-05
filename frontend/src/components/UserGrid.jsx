import { useState, useMemo } from "react";
import { UserCard } from "./UserCard";
import { SearchBar } from "./SearchBar";
import { ArrowUpDown, Users } from "lucide-react";

export function UserGrid({ users, onUserSelect }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");

  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesSearch = user.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterStatus === "all" || user.status === filterStatus;

      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }

      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [users, searchQuery, filterStatus, sortField, sortOrder]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const activeUsers = users.filter((u) => u.status === "Active").length;

  const avgScore = Math.round(
    users.reduce((sum, u) => sum + u.score, 0) / users.length
  );

  return (
    <div className="bg-[#0B1220] border border-gray-700 rounded-xl p-6">

      {/* HEADER */}

      <div className="mb-6 space-y-4">

        <div>
          <div className="flex items-center gap-2 mb-3">

            <Users size={18} className="text-blue-400" />

            <h2 className="text-lg font-bold text-white">
              User Analytics
            </h2>

          </div>

          <div className="flex gap-4 text-sm">

            <div className="text-gray-400">
              <span className="text-green-400 font-semibold">
                {activeUsers}
              </span>{" "}
              Active
            </div>

            <div className="text-gray-400">
              <span className="text-blue-400 font-semibold">
                {avgScore}%
              </span>{" "}
              Avg Score
            </div>

            <div className="text-gray-400">
              <span className="text-yellow-400 font-semibold">
                {users.length}
              </span>{" "}
              Total
            </div>

          </div>

        </div>

        {/* SEARCH */}

        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search users..."
        />

        {/* FILTER + SORT */}

        <div className="flex flex-wrap gap-3">

          {/* FILTER */}

          <div className="flex gap-2 items-center">

            <span className="text-sm text-gray-400">
              Filter:
            </span>

            {["all", "Active", "Idle"].map((status) => (

              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition
                ${
                  filterStatus === status
                    ? "border border-blue-500 text-blue-400 bg-blue-500/10"
                    : "border border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >
                {status}
              </button>

            ))}

          </div>


          {/* SORT */}

          <div className="flex gap-2 items-center ml-auto">

            <span className="text-sm text-gray-400">
              Sort by:
            </span>

            {["name", "score", "status"].map((field) => (

              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition
                ${
                  sortField === field
                    ? "border border-blue-500 text-blue-400 bg-blue-500/10"
                    : "border border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >

                {field.charAt(0).toUpperCase() + field.slice(1)}

                {sortField === field && (
                  <ArrowUpDown
                    size={12}
                    className={sortOrder === "asc" ? "rotate-180" : ""}
                  />
                )}

              </button>

            ))}

          </div>

        </div>

      </div>


      {/* GRID */}

      {filteredAndSortedUsers.length === 0 ? (

        <div className="py-12 text-center text-gray-400">
          No users found matching your criteria
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