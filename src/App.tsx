import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Sidebar } from './components/layout/Sidebar';
import { CeoDashboard } from './pages/CeoDashboard';
import { Login } from './pages/Login';
import { Mr11Dashboard } from './pages/Mr11Dashboard';
import { DepartmentPage } from './pages/DepartmentPage';
import { PlanningPage } from './pages/PlanningPage';
import { ProductionPage } from './pages/ProductionPage';
import { AdminPage } from './pages/AdminPage';
import { isAdmin, canSeeCeoDashboard, canSeeDepartment } from './utils/access';

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

// Opens a page only for users allowed to see it; everyone else lands on MR11
const RequireAccess: React.FC<{ allow: (user: any) => boolean; children: React.ReactNode }> = ({ allow, children }) => {
  const { user } = useAuthStore();
  // The account is still loading after a refresh; the protected layout handles signed-out users
  if (!user) return null;
  return allow(user) ? <>{children}</> : <Navigate to="/mr11" replace />;
};

const DepartmentRoute: React.FC = () => {
  const { code = '' } = useParams();
  return (
    <RequireAccess allow={(user) => canSeeDepartment(user, code)}>
      <DepartmentPage />
    </RequireAccess>
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
              <RequireAccess allow={isAdmin}>
                <AdminPage />
              </RequireAccess>
            </ProtectedLayout>
          }
        />

        <Route
          path="/ceo"
          element={
            <ProtectedLayout>
              <RequireAccess allow={canSeeCeoDashboard}>
                <CeoDashboard />
              </RequireAccess>
            </ProtectedLayout>
          }
        />

        <Route
          path="/departments/PLANNING"
          element={
            <ProtectedLayout>
              <RequireAccess allow={(user) => canSeeDepartment(user, 'PLANNING')}>
                <PlanningPage />
              </RequireAccess>
            </ProtectedLayout>
          }
        />

        <Route
          path="/departments/PRODUCTION"
          element={
            <ProtectedLayout>
              <RequireAccess allow={(user) => canSeeDepartment(user, 'PRODUCTION')}>
                <ProductionPage />
              </RequireAccess>
            </ProtectedLayout>
          }
        />

        <Route
          path="/departments/:code"
          element={
            <ProtectedLayout>
              <DepartmentRoute />
            </ProtectedLayout>
          }
        />

        <Route path="*" element={<Navigate to="/mr11" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;