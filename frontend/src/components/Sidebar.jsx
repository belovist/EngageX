import { Menu, X, BarChart3, Users, Download } from "lucide-react";
import { useState } from "react";

export function Sidebar({ activeView, onViewChange }) {
  const [open, setOpen] = useState(true);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "monitor", label: "Live Monitor", icon: Users },
    { id: "export", label: "Export Data", icon: Download },
  ];

  return (
    <>
      {/* HAMBURGER BUTTON */}

      <button
        onClick={() => setOpen(!open)}
        className="
        fixed top-5 left-5 z-50
        p-2 rounded-xl
        bg-white/5 backdrop-blur
        border border-white/10
        hover:bg-white/10
        transition-all
      "
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>


      {/* SIDEBAR */}

      <nav
        className={`
        fixed top-0 left-0 h-full w-64
        bg-[#020617]
        border-r border-white/10
        p-6 pt-16
        transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}
      >

  


        {/* MENU */}

        <div className="space-y-2">

          {menuItems.map(({ id, label, icon: Icon }) => (

            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={`
              relative w-full flex items-center gap-3 px-4 py-3 rounded-xl
              transition-all duration-300
              ${
                activeView === id
                  ? "bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-400/30 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }
            `}
            >

              {activeView === id && (
                <div
                  className="
                  absolute right-0 h-6 w-1
                  bg-gradient-to-b from-blue-400 to-purple-500
                  rounded-full
                  shadow-[0_0_10px_rgba(139,92,246,0.8)]
                "
                />
              )}

              <Icon size={20} />

              <span className="font-medium">
                {label}
              </span>

            </button>

          ))}

        </div>

      </nav>
    </>
  );
}
