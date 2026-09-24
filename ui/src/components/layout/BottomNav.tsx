import React from 'react';
import { useRouter } from 'next/router';
import { Home, User, MessagesSquare } from 'lucide-react';

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'threads', label: 'Threads', icon: MessagesSquare, path: '/threads' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

const BottomNav: React.FC = () => {
  const router = useRouter();

  return (
    <nav
      id="bottom-nav"
      // UX IMPROVEMENT: 
      // 1. Lowered z-index to z-[90] so modals (z-[100]) cleanly obscure it.
      // 2. Swapped subtle border for a soft shadow mix to lift it cleanly off backend timeline feeds.
      // 3. Integrated modern safe area spacing via utilities alongside standard layouts.
      className="fixed bottom-0 left-0 right-0 z-[90] bg-white/95 backdrop-blur-md border-t border-gray-100/80 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.04)] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Increased height slightly to h-16.5 (66px) for comfortable thumb extension */}
      <div className="flex items-center justify-around h-[66px] max-w-xl mx-auto px-4">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive =
            path === '/' ? router.pathname === '/' : router.pathname.startsWith(path);
          
          return (
            <button
              key={id}
              id={`bottom-nav-${id}`}
              onClick={() => router.push(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex flex-col items-center justify-center flex-1 h-full cursor-pointer select-none',
                // UI IMPROVEMENT: Native tactile elastic feedback when tapped
                'transition-all duration-200 ease-out active:scale-95 touch-manipulation',
                isActive ? 'text-[#118451]' : 'text-gray-400 hover:text-gray-500',
              ].join(' ')}
            >
              {/* Icon Capsule Frame */}
              <span className={[
                'flex items-center justify-center transition-all duration-200 ease-out',
                // UX IMPROVEMENT: Used a structural pill indicator frame to echo iOS/Material Design guidelines
                'w-14 h-8 rounded-full mb-1',
                isActive ? 'bg-[#e8f5f0] text-[#118451]' : 'bg-transparent',
              ].join(' ')}>
                <Icon 
                  size={22} // Scaled up slightly for enhanced optical balance inside mobile view grids
                  strokeWidth={isActive ? 2.25 : 1.75} 
                  className="transition-transform duration-200"
                />
              </span>
              
              {/* Text Tag label */}
              <span className={[
                'text-[11px] tracking-wide transition-all duration-150',
                isActive ? 'font-bold text-[#118451] scale-102' : 'font-medium',
              ].join(' ')}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;