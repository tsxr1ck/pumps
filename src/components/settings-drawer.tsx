import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from 'framer-motion';

interface Prices {
  regular: number;
  premium: number;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  prices: Prices;
  onUpdatePrices: (p: Prices) => void;
}

export default function SettingsDrawer({ open, onClose, prices, onUpdatePrices }: SettingsDrawerProps) {
  const [regularPrice, setRegularPrice] = useState<string>('');
  const [premiumPrice, setPremiumPrice] = useState<string>('');

  useEffect(() => {
    if (open) {
      setRegularPrice(prices.regular.toString());
      setPremiumPrice(prices.premium.toString());
    }
  }, [open, prices]);

  const handleSave = (): void => {
    onUpdatePrices({
      regular: parseFloat(regularPrice) || 0,
      premium: parseFloat(premiumPrice) || 0
    });
    onClose();
  };

  const handlePriceChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] overflow-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Precios de Combustible</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              <p className="text-slate-400 text-sm">
                Establece el precio por litro para cada tipo de combustible. Estos precios se usarán para calcular las ventas.
              </p>

              {/* Regular Price */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/20 border border-slate-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <Label className="text-slate-300 font-semibold">Combustible Regular</Label>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={regularPrice}
                    onChange={handlePriceChange(setRegularPrice)}
                    className="h-14 pl-11 bg-slate-900/50 border-slate-700/30 text-white text-xl font-bold placeholder:text-slate-600 focus:border-slate-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">por litro</span>
                </div>
              </div>

              {/* Premium Price */}
              <div className="bg-gradient-to-br from-red-950/50 to-red-900/20 border border-red-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <Label className="text-red-400 font-semibold">Combustible Premium</Label>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={premiumPrice}
                    onChange={handlePriceChange(setPremiumPrice)}
                    className="h-14 pl-11 bg-slate-900/50 border-red-800/30 text-white text-xl font-bold placeholder:text-slate-600 focus:border-red-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">por litro</span>
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                className="w-full h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold text-lg rounded-xl shadow-lg shadow-red-500/20"
              >
                <Save className="w-5 h-5 mr-2" />
                Guardar Precios
              </Button>
            </div>

            {/* Safe area padding for mobile */}
            <div className="h-8" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}