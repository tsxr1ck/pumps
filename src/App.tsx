import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import Login from '@/pages/Login';
import DispatcherLayout from '@/pages/dispatcher/DispatcherLayout';
import PumpView from '@/pages/dispatcher/PumpView';
import ManagerLayout from '@/pages/manager/ManagerLayout';
import DashboardPage from '@/pages/manager/DashboardPage';
import PricesPage from '@/pages/manager/PricesPage';
import CreditsPage from '@/pages/manager/CreditsPage';
import UsersPage from '@/pages/manager/UsersPage';
import ShiftHistoryPage from '@/pages/manager/ShiftHistoryPage';
import ShiftDetailPage from '@/pages/manager/ShiftDetailPage';
import WithdrawalApprovalPage from '@/pages/manager/WithdrawalApprovalPage';

export default function App() {
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dispatch/*"
        element={
          <ProtectedRoute allowedRoles={['Dispatcher']}>
            <DispatcherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PumpView />} />
      </Route>
      <Route
        path="/manage/*"
        element={
          <ProtectedRoute allowedRoles={['Manager']}>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="prices" element={<PricesPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="shifts" element={<ShiftHistoryPage />} />
        <Route path="shifts/:id" element={<ShiftDetailPage />} />
        <Route path="withdrawals/pending" element={<WithdrawalApprovalPage />} />
      </Route>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'Manager' ? '/manage' : '/dispatch'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
