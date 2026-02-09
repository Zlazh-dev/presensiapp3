import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Sidebar />
            <main className="pl-64 min-h-screen">
                <div className="container mx-auto p-8 max-w-7xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
