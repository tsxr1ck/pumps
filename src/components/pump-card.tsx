import React from 'react';
import { Fuel } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FuelReading {
  initial: string;
  current: string;
}

interface Pump {
  regular: FuelReading;
  premium: FuelReading;
}

type FuelType = 'regular' | 'premium';
type Field = 'initial' | 'current';

interface Prices {
  regular: number;
  premium: number;
}

interface PumpCardProps {
  pumpNumber: number;
  pump: Pump;
  prices: Prices;
  onUpdate: (fuelType: FuelType, field: Field, value: string) => void;
  calculateLiters: (initial: string, current: string) => number;
}

export default function PumpCard({ pumpNumber, pump, prices, onUpdate, calculateLiters }: PumpCardProps) {
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

  const regularLiters: number = calculateLiters(pump.regular.initial, pump.regular.current);
  const premiumLiters: number = calculateLiters(pump.premium.initial, pump.premium.current);
  const regularCash: number = regularLiters * prices.regular;
  const premiumCash: number = premiumLiters * prices.premium;
  const totalCash: number = regularCash + premiumCash;

  const handleInputChange = (fuelType: FuelType, field: Field, e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    // Allow empty string or valid numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onUpdate(fuelType, field, value);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden">
      {/* Pump Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg">
              <Fuel className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Bomba #{pumpNumber}</h2>
              <p className="text-slate-500 text-sm">Activa</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs">Total Bomba</p>
            <p className="text-2xl font-bold text-white">${formatCurrency(totalCash)}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Regular Fuel Section */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/20 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-400 shadow-lg shadow-slate-400/50" />
              <span className="text-slate-300 font-semibold">Regular</span>
              <span className="text-slate-500 text-sm">${prices.regular}/L</span>
            </div>
            <div className="text-right">
              <span className="text-slate-200 font-bold text-lg">${formatCurrency(regularCash)}</span>
              <span className="text-slate-500 text-xs block">{formatLiters(regularLiters)}L</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Inicial</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={pump.regular.initial}
                onChange={(e) => handleInputChange('regular', 'initial', e)}
                className="h-12 bg-slate-900/50 border-slate-700/30 text-white text-lg font-medium placeholder:text-slate-600 focus:border-slate-500 focus:ring-slate-500/20"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Actual</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={pump.regular.current}
                onChange={(e) => handleInputChange('regular', 'current', e)}
                className="h-12 bg-slate-900/50 border-slate-700/30 text-white text-lg font-medium placeholder:text-slate-600 focus:border-slate-500 focus:ring-slate-500/20"
              />
            </div>
          </div>
        </div>

        {/* Premium Fuel Section */}
        <div className="bg-gradient-to-br from-red-950/50 to-red-900/20 border border-red-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
              <span className="text-red-400 font-semibold">Premium</span>
              <span className="text-slate-500 text-sm">${prices.premium}/L</span>
            </div>
            <div className="text-right">
              <span className="text-red-300 font-bold text-lg">${formatCurrency(premiumCash)}</span>
              <span className="text-red-600 text-xs block">{formatLiters(premiumLiters)}L</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Inicial</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={pump.premium.initial}
                onChange={(e) => handleInputChange('premium', 'initial', e)}
                className="h-12 bg-slate-900/50 border-red-800/30 text-white text-lg font-medium placeholder:text-slate-600 focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Actual</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={pump.premium.current}
                onChange={(e) => handleInputChange('premium', 'current', e)}
                className="h-12 bg-slate-900/50 border-red-800/30 text-white text-lg font-medium placeholder:text-slate-600 focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}