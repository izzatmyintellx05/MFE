import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;