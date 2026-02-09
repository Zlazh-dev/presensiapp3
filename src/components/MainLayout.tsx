import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar />
            <main className="flex-1 lg:ml-0 overflow-auto">
                <div className="p-4 md:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
