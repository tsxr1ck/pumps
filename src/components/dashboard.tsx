import { Banknote, Droplets, TrendingDown, Wallet } from 'lucide-react';

interface DashboardProps {
  totalSales: number;
  totalLiters: number;
  totalWithdrawals: number;
  cashInHand: number;
  regularLiters: number;
  premiumLiters: number;
  regularCash: number;
  premiumCash: number;
}

export default function Dashboard({
  totalSales,
  totalLiters,
  totalWithdrawals,
  cashInHand,
  regularLiters,
  premiumLiters,
  regularCash,
  premiumCash
}: DashboardProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatLiters = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  };

  return (
    <div className="px-4 py-5">
      {/* Main Cash In Hand Card */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-red-600 via-red-500 to-red-600 p-5 mb-4 shadow-2xl shadow-red-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-red-100" />
            <span className="text-red-100 text-sm font-medium">Efectivo en Mano</span>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight">
            ${formatCurrency(cashInHand)}
          </p>
          <p className="text-red-100/80 text-sm mt-1">
            Después de retiros
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Sales */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Banknote className="w-4 h-4 text-blue-400" />
            <span className="text-slate-500 text-xs">Ventas</span>
          </div>
          <p className="text-white font-bold text-lg">${formatCurrency(totalSales)}</p>
        </div>

        {/* Withdrawals */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500 text-xs">Salidas</span>
          </div>
          <p className="text-white font-bold text-lg">-${formatCurrency(totalWithdrawals)}</p>
        </div>

        {/* Total Liters */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-500 text-xs">Litros</span>
          </div>
          <p className="text-white font-bold text-lg">{formatLiters(totalLiters)}L</p>
        </div>
      </div>

      {/* Fuel Type Breakdown */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Regular */}
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-400 text-xs font-medium">Regular</span>
            </div>
            <span className="text-slate-300 text-xs">{formatLiters(regularLiters)}L</span>
          </div>
          <p className="text-white font-semibold">${formatCurrency(regularCash)}</p>
        </div>

        {/* Premium */}
        <div className="bg-slate-900/50 border border-red-900/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400 text-xs font-medium">Premium</span>
            </div>
            <span className="text-red-400 text-xs">{formatLiters(premiumLiters)}L</span>
          </div>
          <p className="text-white font-semibold">${formatCurrency(premiumCash)}</p>
        </div>
      </div>
    </div>
  );
}