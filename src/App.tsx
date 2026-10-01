import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Sidebar } from './components/layout/Sidebar';
import { CeoDashboard } from './pages/CeoDashboard';
import { Login } from './pages/Login';
import { Mr11Dashboard } from './pages/Mr11Dashboard';
import { DepartmentPage } from './pages/DepartmentPage';
import { PlanningPage } from './pages/PlanningPage';
import { ProductionPage } from './pages/ProductionPage';
import { AdminPage } from './pages/AdminPage';

// Protected layout with synchronous localStorage fallback
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  const storedToken = token || localStorage.getItem('mfe_token');

  if (!storedToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  const { token, initAuth } = useAuthStore();

  useEffect(() => {
    const activeToken = token || localStorage.getItem('mfe_token');
    if (activeToken) {
      initAuth();
    }
  }, [token, initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/mr11"
          element={
            <ProtectedLayout>
              <Mr11Dashboard />
            </ProtectedLayout>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedLayout>
              <AdminPage />
            </ProtectedLayout>
          }
        />

          <Route
          path="/ceo"
          element={
            <ProtectedLayout>
              <CeoDashboard />
            </ProtectedLayout>
            }
/>

        <Route
          path="/departments/PLANNING"
          element={
            <ProtectedLayout>
              <PlanningPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/departments/PRODUCTION"
          element={
            <ProtectedLayout>
              <ProductionPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/departments/:code"
          element={
            <ProtectedLayout>
              <DepartmentPage />
            </ProtectedLayout>
          }
        />

        <Route path="*" element={<Navigate to="/mr11" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;