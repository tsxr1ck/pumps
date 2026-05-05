import { useState, useEffect } from 'react';
import { X, CreditCard, Receipt, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getJson } from '@/lib/api';
import type { Pump, CreditCategory } from '@/types';

interface TransactionFormProps {
  open: boolean;
  pumps: Pump[];
  onSubmit: (tx: {
    pumpId?: string;
    type: 'Card' | 'Credit';
    amount: number;
    cardLast4?: string;
    creditCategoryId?: string;
    note?: string;
  }) => void;
}

export default function TransactionForm({ open, pumps, onSubmit }: TransactionFormProps) {
  const [type, setType] = useState<'Card' | 'Credit'>('Card');
  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [note, setNote] = useState('');
  const [selectedPumpId, setSelectedPumpId] = useState('');
  const [selectedCreditCategory, setSelectedCreditCategory] = useState('');
  const [creditCategories, setCreditCategories] = useState<CreditCategory[]>([]);

  useEffect(() => {
    if (open && type === 'Credit') {
      getJson<{ categories: CreditCategory[] }>('/credits')
        .then((data) => setCreditCategories(data.categories.filter((c) => c.isActive)))
        .catch(() => setCreditCategories([]));
    }
  }, [open, type]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    const payload: any = { type, amount: numAmount, note: note || undefined };
    if (selectedPumpId) payload.pumpId = selectedPumpId;
    if (liters) payload.liters = parseFloat(liters);
    if (type === 'Card' && cardLast4) payload.cardLast4 = cardLast4;
    if (type === 'Credit' && selectedCreditCategory) payload.creditCategoryId = selectedCreditCategory;

    onSubmit(payload);
    resetForm();
  };

  const resetForm = () => {
    setType('Card');
    setAmount('');
    setLiters('');
    setCardLast4('');
    setNote('');
    setSelectedPumpId('');
    setSelectedCreditCategory('');
  };

  const handleAmountChange = (v: string) => {
    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  const handleCardChange = (v: string) => {
    if (v === '' || /^\d{0,4}$/.test(v)) setCardLast4(v);
  };

  const isValid = amount && parseFloat(amount) > 0 && (type === 'Card' || (type === 'Credit' && selectedCreditCategory));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[90vh] overflow-auto"
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-slate-700" />
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Nueva Transacción</h2>
              <Button variant="ghost" size="icon" onClick={resetForm} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setType('Card')}
                  className={cn(
                    'h-14 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    type === 'Card'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  <CreditCard className="w-5 h-5" />
                  Tarjeta
                </button>
                <button
                  onClick={() => setType('Credit')}
                  className={cn(
                    'h-14 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    type === 'Credit'
                      ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  <Receipt className="w-5 h-5" />
                  Crédito
                </button>
              </div>

              <div>
                <p className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5" />
                  Bomba (opcional)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedPumpId('')}
                    className={cn(
                      'h-12 rounded-xl border text-sm font-medium transition-all',
                      selectedPumpId === ''
                        ? 'bg-slate-700 border-slate-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    Ninguna
                  </button>
                  {pumps.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPumpId(p.id)}
                      className={cn(
                        'h-12 rounded-xl border text-sm font-semibold transition-all',
                        selectedPumpId === p.id
                          ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      #{p.number}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-xs mb-2">Monto</p>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="h-16 bg-slate-800 border-slate-700 text-white text-2xl font-bold placeholder:text-slate-600 focus:border-slate-500 text-center"
                  autoFocus
                />
              </div>

             

              {type === 'Card' && (
                <div>
                  <p className="text-slate-400 text-xs mb-2">Últimos 4 dígitos</p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000"
                    value={cardLast4}
                    onChange={(e) => handleCardChange(e.target.value)}
                    className="h-12 bg-slate-800 border-slate-700 text-white text-lg font-medium placeholder:text-slate-600 focus:border-slate-500 text-center tracking-widest"
                    maxLength={4}
                  />
                </div>
              )}

              {type === 'Credit' && (
                <div>
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    Categoría de Crédito
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {creditCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCreditCategory(c.id)}
                        className={cn(
                          'h-14 rounded-xl border text-sm font-semibold transition-all px-3',
                          selectedCreditCategory === c.id
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  {creditCategories.length === 0 && (
                    <p className="text-slate-500 text-xs mt-2 text-center">Cargando categorías...</p>
                  )}
                </div>
              )}

             

              <Button
                onClick={handleSubmit}
                disabled={!isValid}
                className={cn(
                  'w-full h-16 text-lg font-bold rounded-xl shadow-lg transition-all',
                  isValid
                    ? 'bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-red-500/20'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                )}
              >
                <Receipt className="w-5 h-5 mr-2" />
                Registrar
              </Button>
            </div>

            <div className="h-8" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
