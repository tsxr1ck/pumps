import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function DispatcherLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { subscribe } = useSocket();

  useEffect(() => {
    const unsub = subscribe('shift:closed', () => {
      toast.error('El turno ha sido cerrado');
      logout();
      navigate('/login', { replace: true });
    });
    return unsub;
  }, [subscribe, logout, navigate]);

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
      <Outlet />
    </div>
  );
}
