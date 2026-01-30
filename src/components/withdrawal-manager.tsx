import React, { useState } from 'react';
import { Plus, Trash2, TrendingDown, Receipt } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Withdrawal {
  id: string | number;
  amount: number;
  note: string;
  timestamp: string;
}

type NewWithdrawal = Omit<Withdrawal, 'id'>;

interface WithdrawalManagerProps {
  withdrawals: Withdrawal[];
  onAdd: (w: NewWithdrawal) => void;
  onRemove: (id: string | number) => void;
  totalWithdrawals: number;
}

export default function WithdrawalManager({ withdrawals, onAdd, onRemove, totalWithdrawals }: WithdrawalManagerProps) {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newAmount, setNewAmount] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const handleAdd = (): void => {
    const amount = parseFloat(newAmount);
    if (amount > 0) {
      const payload: NewWithdrawal = {
        amount,
        note: newNote || 'Retiro',
        timestamp: new Date().toISOString(),
      };
      onAdd(payload);
      setNewAmount('');
      setNewNote('');
      setIsAdding(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewAmount(value);
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="px-4 pb-8">
      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Retiros</h2>
                <p className="text-slate-500 text-xs">{withdrawals.length} transacción{withdrawals.length !== 1 ? 'es' : ''}</p>
              </div>
              </div>
              <div className="text-right">
              <p className="text-slate-500 text-xs">Total Salidas</p>
              <p className="text-xl font-bold text-slate-300">-${formatCurrency(totalWithdrawals)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Add Button / Form */}
          {!isAdding ? (
            <Button
              onClick={() => setIsAdding(true)}
              className="w-full h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar Retiro
            </Button>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Monto"
                value={newAmount}
                onChange={handleAmountChange}
                className="h-12 bg-slate-900/50 border-slate-600 text-white text-lg font-medium placeholder:text-slate-500 focus:border-red-500"
                autoFocus
              />
              <Input
                type="text"
                placeholder="Nota (opcional)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-red-500"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsAdding(false)}
                  variant="ghost"
                  className="flex-1 h-11 text-slate-400 hover:text-white hover:bg-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAdd}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                >
                  Agregar
                </Button>
              </div>
            </div>
          )}

          {/* Withdrawal List */}
          {withdrawals.length > 0 && (
            <div className="mt-4 space-y-2">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{withdrawal.note}</p>
                      <p className="text-slate-500 text-xs">{formatTime(withdrawal.timestamp)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 font-bold">-${formatCurrency(withdrawal.amount)}</span>
                    <Button
                      onClick={() => onRemove(withdrawal.id)}
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {withdrawals.length === 0 && !isAdding && (
            <p className="text-center text-slate-600 text-sm py-4">No hay retiros registrados</p>
          )}
        </div>
      </div>
    </div>
  );
}