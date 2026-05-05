import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, ArrowLeft } from 'lucide-react';

interface PinPadProps {
  onSubmit: (numericId: string, pin: string) => void;
  error?: string;
  loading?: boolean;
}

export default function PinPad({ onSubmit, error, loading }: PinPadProps) {
  const [numericId, setNumericId] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'id' | 'pin'>('id');

  const handleNumber = (num: string) => {
    if (step === 'id') {
      if (numericId.length < 6) setNumericId((prev) => prev + num);
    } else {
      if (pin.length < 6) setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    if (step === 'id') {
      setNumericId((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleNext = () => {
    if (step === 'id' && numericId.length >= 1) {
      setStep('pin');
    }
  };

  const handleSubmit = () => {
    if (pin.length >= 4) {
      onSubmit(numericId, pin);
    }
  };

  const handleReset = () => {
    setNumericId('');
    setPin('');
    setStep('id');
  };

  const displayValue = step === 'id' ? numericId : '•'.repeat(pin.length);
  const canSubmit = step === 'pin' && pin.length >= 4;
  const canNext = step === 'id' && numericId.length >= 1;

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Display */}
      <div className="mb-8 text-center">
        <p className="text-slate-400 text-sm mb-2">
          {step === 'id' ? 'Ingresa tu número de usuario' : 'Ingresa tu PIN'}
        </p>
        <div className="h-16 flex items-center justify-center">
          <span className="text-4xl font-bold text-white tracking-widest">
            {displayValue || ' '}
          </span>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-sm mt-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            onClick={() => handleNumber(num)}
            className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 text-2xl font-semibold text-white active:bg-slate-700 transition-colors"
          >
            {num}
          </button>
        ))}
        <button
          onClick={step === 'id' ? handleReset : () => setStep('id')}
          className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
        >
          {step === 'id' ? 'C' : <ArrowLeft className="w-6 h-6" />}
        </button>
        <button
          onClick={() => handleNumber('0')}
          className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 text-2xl font-semibold text-white active:bg-slate-700 transition-colors"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Action button */}
      <div className="mt-6">
        {step === 'id' ? (
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors"
          >
            Continuar
          </button>
        ) : (
          <button
            onClick={canSubmit ? handleSubmit : undefined}
            disabled={!canSubmit || loading}
            className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        )}
      </div>
    </div>
  );
}
