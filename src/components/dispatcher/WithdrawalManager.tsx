import { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingDown, Receipt, ChevronDown, ChevronUp, CreditCard, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency, formatTime } from '@/lib/formatters';
import type { Withdrawal, Transaction } from '@/types';

interface WithdrawalManagerProps {
  withdrawals: Withdrawal[];
  transactions: Transaction[];
  onAdd: (amount: number, note: string) => void;
  onRemove: (id: string) => void;
  totalWithdrawals: number;
}

export default function WithdrawalManager({ withdrawals, transactions, onAdd, onRemove, totalWithdrawals }: WithdrawalManagerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { unwithdrawnCash, unwithdrawnNonCash, unwithdrawnCashTotal, unwithdrawnNonCashTotal } = useMemo(() => {
    const cash = transactions.filter((t) => t.type === 'Cash' && !t.withdrawalId);
    const nonCash = transactions.filter((t) => t.type !== 'Cash' && !t.withdrawalId);
    return {
      unwithdrawnCash: cash,
      unwithdrawnNonCash: nonCash,
      unwithdrawnCashTotal: cash.reduce((sum, t) => sum + Number(t.amount), 0),
      unwithdrawnNonCashTotal: nonCash.reduce((sum, t) => sum + Number(t.amount), 0),
    };
  }, [transactions]);

  const cashInput = parseFloat(newAmount) || 0;
  const projectedTotal = cashInput + unwithdrawnNonCashTotal;

  const handleAdd = (): void => {
    if (cashInput > 0) {
      onAdd(cashInput, newNote || 'Retiro');
      setNewAmount('');
      setNewNote('');
      setDrawerOpen(false);
    }
  };

  const handleAmountChange = (v: string) => {
    if (v === '' || /^\d*\.?\d*$/.test(v)) setNewAmount(v);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Card': return <span className="text-xs bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded">T</span>;
      case 'Credit': return <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">C</span>;
      default: return <span className="text-xs bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded">E</span>;
    }
  };

  return (
    <div className="mt-4">
      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden">
        <div className="bg-linear-to-r from-slate-800 to-slate-800/50 px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Retiros</h2>
                <p className="text-slate-500 text-xs">{withdrawals.length} retiro{withdrawals.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">Total Retirado</p>
              <p className="text-xl font-bold text-slate-300">-${formatCurrency(totalWithdrawals)}</p>
            </div>
          </div>
        </div>

        {(unwithdrawnCash.length > 0 || unwithdrawnNonCash.length > 0) && (
          <div className="px-5 py-3 bg-amber-950/20 border-b border-slate-700/50 space-y-2">
            {unwithdrawnCash.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm">{unwithdrawnCash.length} efectivo sin retirar</span>
                </div>
                <span className="text-emerald-400 font-bold text-sm">${formatCurrency(unwithdrawnCashTotal)}</span>
              </div>
            )}
            {unwithdrawnNonCash.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 text-sm">{unwithdrawnNonCash.length} no-efectivo pendiente</span>
                </div>
                <span className="text-blue-400 font-bold text-sm">${formatCurrency(unwithdrawnNonCashTotal)}</span>
              </div>
            )}
            {unwithdrawnNonCash.length > 0 && (
              <p className="text-amber-600 text-xs">Las operaciones no-efectivo se incluirán automáticamente.</p>
            )}
          </div>
        )}

        <div className="p-4">
          <Button
            onClick={() => setDrawerOpen(true)}
            className="w-full h-14 bg-linear-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 border border-slate-600 text-slate-200 rounded-xl font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Agregar Retiro
          </Button>

          {withdrawals.length > 0 && (
            <div className="mt-4 space-y-2">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id}>
                  <div
                    className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 group cursor-pointer"
                    onClick={() => setExpandedId(expandedId === withdrawal.id ? null : withdrawal.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{withdrawal.note}</p>
                        <p className="text-slate-500 text-xs">{formatTime(withdrawal.recordedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 font-bold">-${formatCurrency(Number(withdrawal.amount))}</span>
                      <Button
                        onClick={(e) => { e.stopPropagation(); onRemove(withdrawal.id); }}
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {expandedId === withdrawal.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {expandedId === withdrawal.id && (
                    <div className="mx-2 mt-1 mb-2 bg-slate-800/20 border border-slate-700/30 rounded-lg px-4 py-3">
                      {withdrawal.coveredTransactionCount !== undefined && (
                        <div className="space-y-1">
                          <p className="text-slate-400 text-xs">
                            <span className="text-emerald-400 font-medium">{withdrawal.coveredTransactionCount}</span> transacciones cubiertas
                          </p>
                          {withdrawal.coveredAmount !== undefined && (
                            <p className="text-slate-400 text-xs">Monto cubierto: <span className="text-white font-medium">${formatCurrency(withdrawal.coveredAmount)}</span></p>
                          )}
                          {withdrawal.latestTransactionAt && (
                            <p className="text-slate-400 text-xs">Hasta: <span className="text-white font-medium">{formatTime(withdrawal.latestTransactionAt)}</span></p>
                          )}
                        </div>
                      )}
                      {transactions.filter((t) => t.withdrawalId === withdrawal.id).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1">
                          <p className="text-slate-500 text-xs font-medium mb-1">Transacciones incluidas:</p>
                          {transactions.filter((t) => t.withdrawalId === withdrawal.id).map((t) => (
                            <div key={t.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 flex items-center gap-1.5">
                                {getTypeBadge(t.type)}{t.note || 'Venta'} • {formatTime(t.recordedAt)}
                              </span>
                              <span className="text-white font-medium">${formatCurrency(Number(t.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {withdrawals.length === 0 && (
            <p className="text-center text-slate-600 text-sm py-4">No hay retiros registrados</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] overflow-auto"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-slate-700" />
              </div>

              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white">Registrar Retiro</h2>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                  <TrendingDown className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-5 space-y-5">
                {unwithdrawnNonCash.length > 0 && (
                  <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <p className="text-blue-400 text-sm font-semibold">Se incluirán automáticamente</p>
                    </div>
                    <div className="space-y-1.5">
                      {unwithdrawnNonCash.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            {getTypeBadge(t.type)}{t.note || (t.type === 'Card' ? `****${t.cardLast4}` : t.creditCategoryName || 'Crédito')}
                            <span className="text-slate-600">• {formatTime(t.recordedAt)}</span>
                          </span>
                          <span className="text-white font-medium">${formatCurrency(Number(t.amount))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-blue-800/30">
                      <span className="text-blue-400 text-xs font-medium">Total no-efectivo</span>
                      <span className="text-blue-400 font-bold text-sm">+${formatCurrency(unwithdrawnNonCashTotal)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" />
                    Efectivo a Retirar
                  </p>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-16 bg-slate-800 border-slate-700 text-white text-2xl font-bold placeholder:text-slate-600 focus:border-red-500 text-center"
                    autoFocus
                  />
                </div>

                {(cashInput > 0 || unwithdrawnNonCashTotal > 0) && (
                  <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-emerald-400" />Efectivo</span>
                      <span className="text-white font-medium">${formatCurrency(cashInput)}</span>
                    </div>
                    {unwithdrawnNonCashTotal > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-blue-400" />No-efectivo ({unwithdrawnNonCash.length})</span>
                        <span className="text-white font-medium">${formatCurrency(unwithdrawnNonCashTotal)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/30">
                      <span className="text-white font-semibold">Total del retiro</span>
                      <span className="text-red-400 font-bold text-lg">${formatCurrency(projectedTotal)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-slate-400 text-xs mb-2">Nota (opcional)</p>
                  <Input
                    type="text"
                    placeholder="Nota del retiro..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-red-500"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setDrawerOpen(false)}
                    variant="ghost"
                    className="flex-1 h-14 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl text-base font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={!newAmount || cashInput <= 0}
                    className={cn(
                      'flex-1 h-14 text-base font-bold rounded-xl transition-all',
                      newAmount && cashInput > 0
                        ? 'bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/20'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    )}
                  >
                    Confirmar ${formatCurrency(projectedTotal)}
                  </Button>
                </div>
              </div>

              <div className="h-8" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
