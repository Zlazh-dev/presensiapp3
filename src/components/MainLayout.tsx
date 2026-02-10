import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-950 flex overflow-x-hidden">
            <Sidebar />

            {/* Main content wrapper — dark bg with branding, then rounded white area */}
            <div className="flex-1 min-h-screen flex flex-col min-w-0">
                {/* Top bar with branding (desktop) */}
                <div className="hidden lg:flex items-center justify-end px-8 h-12 flex-shrink-0">
                    <span className="text-white font-bold italic tracking-tight text-sm opacity-80">
                        PresensiApp.
                    </span>
                </div>

                {/* Content area — rounded white card */}
                <main className="flex-1 bg-gray-50 rounded-tl-[2rem] lg:rounded-tl-[2.5rem] overflow-y-auto overflow-x-hidden pt-16 lg:pt-0">
                    <div className="p-4 md:p-6 lg:p-8 pb-8">
                        <Outlet />
                    </div>

                    {/* Decorative sparkle in bottom-right (subtle) */}
                    <div className="fixed bottom-4 right-4 opacity-[0.07] pointer-events-none select-none">
                        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M40 0C40 22.0914 57.9086 40 80 40C57.9086 40 40 57.9086 40 80C40 57.9086 22.0914 40 0 40C22.0914 40 40 22.0914 40 0Z" fill="currentColor" className="text-gray-500" />
                        </svg>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
