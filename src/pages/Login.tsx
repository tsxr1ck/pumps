import { useState } from 'react';
import { motion } from 'framer-motion';
import { Fuel } from 'lucide-react';
import PinPad from '@/components/shared/PinPad';
import { useAuth } from '@/contexts/AuthContext';
import { postJson } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import type { User } from '@/types';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (numericId: string, pin: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await postJson<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        numericId: parseInt(numericId),
        pin,
      });

      login(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });

      if (data.user.role === 'Manager') {
        navigate('/manage', { replace: true });
      } else {
        navigate('/dispatch', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 mb-4">
            <Fuel className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Volumetrico</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestión</p>
        </div>

        <PinPad onSubmit={handleSubmit} error={error} loading={loading} />
      </motion.div>
    </div>
  );
}
