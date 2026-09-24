import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Home,
  User,
  Leaf,
  ChevronRight,
  Plus,
  MessagesSquare
} from 'lucide-react';

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'threads', label: 'Threads', icon: MessagesSquare, path: '/threads' },
  // { id: 'trending', label: 'Trending', icon: TrendingUp, path: '/trending' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

const DesktopSidebar: React.FC = () => {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      id="desktop-sidebar"
      className={[
        'hidden lg:flex flex-col sticky top-0 h-screen border-r border-gray-100',
        'bg-white transition-all duration-200 ease-out flex-shrink-0 z-30',
        collapsed ? 'w-16' : 'w-[180px]',
      ].join(' ')}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-gray-100 flex-shrink-0">
        <div className="w-8 h-8 rounded-[12px] bg-[#118451] flex items-center justify-center flex-shrink-0">
          <Leaf size={16} color="white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="font-extrabold text-gray-900 text-base tracking-tight leading-none truncate block w-full">
            Community-Powered Protocol & Discussion Platform
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive =
            path === '/' ? router.pathname === '/' : router.pathname.startsWith(path);
          return (
            <button
              key={id}
              id={`sidebar-nav-${id}`}
              onClick={() => router.push(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={[
                'w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer',
                'transition-all duration-150 text-sm font-medium',
                isActive
                  ? 'text-[#118451] bg-[#e8f5f0] font-semibold'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50',
              ].join(' ')}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* New Protocol CTA */}
      <div className="px-3 pb-3">
        <button
          id="sidebar-new-protocol"
          onClick={() => router.push('/protocols/create')}
          aria-label="Create new protocol"
          title={collapsed ? 'New Protocol' : undefined}
          className={[
            'w-full flex items-center gap-2.5 cursor-pointer rounded-xl transition-all duration-150',
            'bg-[#118451] text-white hover:bg-[#065c38] active:scale-[0.98] shadow-sm',
            collapsed ? 'justify-center p-2.5' : 'px-4 py-2.5',
          ].join(' ')}
        >
          <Plus size={18} strokeWidth={2.5} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-semibold truncate">New Protocol</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronRight
            size={16}
            className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
