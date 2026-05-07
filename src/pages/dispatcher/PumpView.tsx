import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Settings, Fuel, LogOut, CreditCard, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useShift } from '@/hooks/useShift';
import { useSocket } from '@/hooks/useSocket';
import { getJson, postJson } from '@/lib/api';
import { toast } from 'sonner';
import Dashboard from '@/components/dispatcher/Dashboard';
import PumpCard from '@/components/dispatcher/PumpCard';
import WithdrawalManager from '@/components/dispatcher/WithdrawalManager';
import SettingsDrawer from '@/components/dispatcher/SettingsDrawer';
import TransactionForm from '@/components/dispatcher/TransactionForm';
import type { Pump, GasPrice, Withdrawal, Transaction, MeterReading } from '@/types';

interface PumpReadings {
  [hoseId: string]: { start: string; end: string };
}

export default function PumpView() {
  const { user, logout } = useAuth();
  const { data: shiftData } = useShift();
  const { subscribe } = useSocket();
  const shift = shiftData?.shift;

  const [pumps, setPumps] = useState<Pump[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [readings, setReadings] = useState<PumpReadings>({});
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPump, setCurrentPump] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        if (!shift?.id) {
          setIsLoaded(true);
          return;
        }

        const [pumpsRes, pricesRes, readingsRes, withdrawalsRes, transactionsRes] = await Promise.all([
          getJson<{ pumps: Pump[] }>('/pumps'),
          getJson<{ prices: GasPrice[] }>('/prices/current'),
          getJson<{ readings: MeterReading[] }>(`/readings?shift_id=${shift.id}`),
          getJson<{ withdrawals: Withdrawal[] }>(`/withdrawals?shift_id=${shift.id}`),
          getJson<{ transactions: Transaction[] }>(`/transactions?shift_id=${shift.id}`),
        ]);

        const assignedPumpIds = new Set(
          shift.assignments
            ?.filter((a: any) => a.dispatcherId === user?.id)
            .map((a: any) => a.pumpId) || []
        );

        setPumps(assignedPumpIds.size > 0 ? pumpsRes.pumps.filter((p) => assignedPumpIds.has(p.id)) : pumpsRes.pumps);

        const priceMap: Record<string, number> = {};
        for (const p of pricesRes.prices) {
          const key = p.code || p.gasTypeCode || p.gasTypeId;
          if (key) priceMap[key] = Number(p.price);
        }
        setPrices(priceMap);

        const existingReadings: PumpReadings = {};
        for (const r of readingsRes.readings) {
          existingReadings[r.hoseId] = {
            ...(existingReadings[r.hoseId] || { start: '', end: '' }),
            [r.readingType]: String(r.value),
          };
        }
        setReadings(existingReadings);
        setWithdrawals(withdrawalsRes.withdrawals);
        setTransactions(transactionsRes.transactions);
      } catch (err: any) {
        toast.error(err.message || 'Error cargando datos');
      } finally {
        setIsLoaded(true);
      }
    }
    loadInitialData();
  }, [shift?.id, user?.id]);

  useEffect(() => {
    const unsub = subscribe('withdrawal:created', (data: any) => {
      if (data?.withdrawal?.shift_id === shift?.id) {
        setWithdrawals((prev) => [data.withdrawal, ...prev]);
        if (data.coveredTransactions) {
          setTransactions((prev) =>
            prev.map((t) => {
              const covered = data.coveredTransactions.find((ct: any) => ct.id === t.id);
              return covered ? { ...t, withdrawalId: data.withdrawal.id } : t;
            })
          );
        }
      }
    });
    return unsub;
  }, [subscribe, shift?.id]);

  const updateReading = useCallback((hoseId: string, field: 'start' | 'end', value: string) => {
    setReadings((prev) => ({
      ...prev,
      [hoseId]: { ...(prev[hoseId] || { start: '', end: '' }), [field]: value },
    }));
  }, []);

  const submitReading = useCallback(async (hoseId: string, type: 'start' | 'end', value: string) => {
    if (!shift?.id) { toast.error('No hay turno activo'); return; }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    try {
      await postJson('/readings', { shiftId: shift.id, hoseId, readingType: type, value: num });
      toast.success('Lectura guardada');
    } catch (err: any) {
      toast.error(err.message || 'Error guardando lectura');
    }
  }, [shift?.id]);

  const addTransaction = useCallback(async (tx: { pumpId?: string; type: 'Card' | 'Credit'; amount: number; liters?: number; cardLast4?: string; creditCategoryId?: string; note?: string }) => {
    if (!shift?.id) { toast.error('No hay turno activo'); return; }
    try {
      const data = await postJson<{ transaction: Transaction }>('/transactions', { shiftId: shift.id, ...tx });
      setTransactions((prev) => [data.transaction, ...prev]);
      toast.success('Transacción registrada');
    } catch (err: any) {
      toast.error(err.message || 'Error registrando transacción');
    }
  }, [shift?.id]);

  const addWithdrawal = useCallback(async (amount: number, note: string) => {
    if (!shift?.id) { toast.error('No hay turno activo'); return; }
    try {
      const data = await postJson<{ withdrawal: Withdrawal; coveredTransactions: Transaction[]; coveredAmount: number }>('/withdrawals', { shiftId: shift.id, amount, note });
      setWithdrawals((prev) => [data.withdrawal, ...prev]);
      if (data.coveredTransactions) {
        setTransactions((prev) => prev.map((t) => data.coveredTransactions.find((ct) => ct.id === t.id) ? { ...t, withdrawalId: data.withdrawal.id } : t));
      }
      toast.success(`Retiro registrado. Cubre ${data.coveredTransactions?.length || 0} transacciones ($${data.coveredAmount?.toFixed(2) || '0.00'})`);
    } catch (err: any) {
      toast.error(err.message || 'Error registrando retiro');
    }
  }, [shift?.id]);

  const removeWithdrawal = useCallback(async (id: string) => {
    if (!shift?.id) return;
    try {
      await postJson(`/withdrawals/${id}/delete`, {});
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      setTransactions((prev) => prev.map((t) => t.withdrawalId === id ? { ...t, withdrawalId: null } : t));
      toast.success('Retiro eliminado');
    } catch (err: any) {
      toast.error(err.message || 'Error eliminando retiro');
    }
  }, [shift?.id]);

  const calculateLiters = (initial: string, current: string): number => Math.max(0, (parseFloat(current) || 0) - (parseFloat(initial) || 0));

  const totals = useMemo(() => pumps.reduce((acc, pump) => {
    let pumpRegularLiters = 0, pumpPremiumLiters = 0, pumpRegularCash = 0, pumpPremiumCash = 0;
    for (const hose of pump.hoses) {
      const r = readings[hose.id] || { start: '', end: '' };
      const liters = calculateLiters(r.start, r.end);
      const price = prices[hose.gasTypeCode] || 0;
      const cash = liters * price;
      if (hose.gasTypeCode === 'premium') { pumpPremiumLiters += liters; pumpPremiumCash += cash; }
      else { pumpRegularLiters += liters; pumpRegularCash += cash; }
    }
    return { regularLiters: acc.regularLiters + pumpRegularLiters, premiumLiters: acc.premiumLiters + pumpPremiumLiters, regularCash: acc.regularCash + pumpRegularCash, premiumCash: acc.premiumCash + pumpPremiumCash };
  }, { regularLiters: 0, premiumLiters: 0, regularCash: 0, premiumCash: 0 }), [pumps, readings, prices]);

  const totalSales = totals.regularCash + totals.premiumCash;
  const totalLiters = totals.regularLiters + totals.premiumLiters;
  const totalWithdrawals = useMemo(() => withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0), [withdrawals]);
  const nonCashTotal = useMemo(() => transactions.filter((t) => t.type !== 'Cash').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  // Non-cash amounts bundled into withdrawals (for documentation, not actual cash)
  const nonCashInWithdrawals = useMemo(() => transactions.filter((t) => t.type !== 'Cash' && t.withdrawalId).reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const cashOnlyWithdrawals = totalWithdrawals - nonCashInWithdrawals;
  const cashSales = totalSales - nonCashTotal;
  const cashInHand = cashSales - cashOnlyWithdrawals;

  const goToPump = (index: number) => setCurrentPump(index);
  const nextPump = () => setCurrentPump((prev) => Math.min(pumps.length - 1, prev + 1));
  const prevPump = () => setCurrentPump((prev) => Math.max(0, prev - 1));
  const handleLogout = () => { logout(); window.location.href = '/login'; };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-white">Cargando...</div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <Fuel className="w-12 h-12 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sin Turno Activo</h2>
        <p className="text-slate-500 text-center mb-6">No hay un turno abierto. Contacta al encargado para abrir uno.</p>
        <Button onClick={handleLogout} variant="outline" className="border-slate-700 text-slate-300">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-red-600 to-red-700 flex items-center justify-center">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Volumétrico</h1>
              <p className="text-xs text-slate-500">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setTransactionFormOpen(true)} className="text-slate-400 hover:text-white" title="Nueva transacción">
              <Receipt className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="text-slate-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-xl mx-auto w-full">
        <div ref={dashboardRef}>
          <Dashboard
            totalSales={totalSales}
            totalLiters={totalLiters}
            cashInHand={cashInHand}
            regularLiters={totals.regularLiters}
            premiumLiters={totals.premiumLiters}
            regularCash={totals.regularCash}
            premiumCash={totals.premiumCash}
          />
        </div>

        {pumps.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              {pumps.map((_, index) => (
                <button key={index} onClick={() => goToPump(index)} className={cn('h-2 rounded-full transition-all duration-300', currentPump === index ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-700 hover:bg-slate-600')} />
              ))}
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl">
                <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentPump * 100}%)` }}>
                  {pumps.map((pump) => (
                    <div key={pump.id} className="w-full shrink-0">
                      <PumpCard pumpNumber={pump.number} pump={pump} prices={prices} readings={readings} onUpdateReading={updateReading} onSubmitReading={submitReading} calculateLiters={calculateLiters} />
                    </div>
                  ))}
                </div>
              </div>

              {pumps.length > 1 && (
                <>
                  <button onClick={prevPump} disabled={currentPump === 0} className={cn('absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all', currentPump === 0 ? 'opacity-30' : 'hover:bg-slate-700')}>
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={nextPump} disabled={currentPump === pumps.length - 1} className={cn('absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all', currentPump === pumps.length - 1 ? 'opacity-30' : 'hover:bg-slate-700')}>
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
            </div>
            <p className="text-center text-slate-500 text-sm mt-3">Bomba {currentPump + 1} de {pumps.length}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 pb-4">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400 text-xs">Documentos</span>
            </div>
            <p className="text-xl font-bold text-blue-400">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(nonCashTotal)}</p>
          </div>
        </div>

        <WithdrawalManager withdrawals={withdrawals} transactions={transactions} onAdd={addWithdrawal} onRemove={removeWithdrawal} totalWithdrawals={totalWithdrawals} />
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} prices={prices} onUpdatePrices={() => {}} readOnly />
      <TransactionForm open={transactionFormOpen} pumps={pumps} onSubmit={addTransaction} />
    </div>
  );
}
