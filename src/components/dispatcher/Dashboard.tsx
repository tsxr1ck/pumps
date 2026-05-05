import { Banknote, Droplets, Wallet } from 'lucide-react';
import { formatCurrency, formatLiters } from '@/lib/formatters';

interface DashboardProps {
  totalSales: number;
  totalLiters: number;
  cashInHand: number;
  regularLiters: number;
  premiumLiters: number;
  regularCash: number;
  premiumCash: number;
}

export default function Dashboard({
  totalSales,
  totalLiters,
  cashInHand,
  regularLiters,
  premiumLiters,
  regularCash,
  premiumCash,
}: DashboardProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-red-600 to-red-700 p-4 shadow-xl shadow-red-500/20">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
          <Wallet className="w-5 h-5 text-red-100 mb-2" />
          <p className="text-red-100 text-xs font-medium mb-1">Efectivo</p>
          <p className="text-2xl font-bold text-white">${formatCurrency(cashInHand)}</p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4">
          <Banknote className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-slate-500 text-xs font-medium mb-1">Ventas</p>
          <p className="text-2xl font-bold text-white">${formatCurrency(totalSales)}</p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4">
          <Droplets className="w-5 h-5 text-cyan-400 mb-2" />
          <p className="text-slate-500 text-xs font-medium mb-1">Litros</p>
          <p className="text-2xl font-bold text-white">{formatLiters(totalLiters)}L</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-400 text-xs font-medium">Regular</span>
          </div>
          <p className="text-lg font-bold text-white">${formatCurrency(regularCash)}</p>
          <p className="text-slate-500 text-xs">{formatLiters(regularLiters)}L</p>
        </div>

        <div className="bg-slate-900/60 border border-red-900/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs font-medium">Premium</span>
          </div>
          <p className="text-lg font-bold text-white">${formatCurrency(premiumCash)}</p>
          <p className="text-red-500 text-xs">{formatLiters(premiumLiters)}L</p>
        </div>
      </div>
    </div>
  );
}
