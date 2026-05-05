import React from 'react';
import { Fuel } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatLiters } from '@/lib/formatters';
import type { Pump, Hose } from '@/types';

interface PumpCardProps {
  pumpNumber: number;
  pump: Pump;
  prices: Record<string, number>;
  readings: Record<string, { start: string; end: string }>;
  onUpdateReading: (hoseId: string, field: 'start' | 'end', value: string) => void;
  onSubmitReading: (hoseId: string, field: 'start' | 'end', value: string) => void;
  calculateLiters: (initial: string, current: string) => number;
}



export default function PumpCard({
  pumpNumber,
  pump,
  prices,
  readings,
  onUpdateReading,
  onSubmitReading,
  calculateLiters,
}: PumpCardProps) {


  let totalCash = 0;

  const handleInputChange = (hoseId: string, field: 'start' | 'end', e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onUpdateReading(hoseId, field, value);
    }
  };

  const handleBlur = (hoseId: string, field: 'start' | 'end', value: string) => {
    if (value) {
      onSubmitReading(hoseId, field, value);
    }
  };

  const regularHose = pump.hoses.find((h) => h.gasTypeCode === 'regular');
  const premiumHose = pump.hoses.find((h) => h.gasTypeCode === 'premium');

  const regularReading = regularHose ? readings[regularHose.id] || { start: '', end: '' } : { start: '', end: '' };
  const premiumReading = premiumHose ? readings[premiumHose.id] || { start: '', end: '' } : { start: '', end: '' };

  const regularLiters = calculateLiters(regularReading.start, regularReading.end);
  const premiumLiters = calculateLiters(premiumReading.start, premiumReading.end);
  const regularCash = regularLiters * (prices['regular'] || 0);
  const premiumCash = premiumLiters * (prices['premium'] || 0);
  totalCash = regularCash + premiumCash;

  const renderFuelSection = (hose: Hose | undefined, label: string, reading: { start: string; end: string }, liters: number, cash: number) => {
    if (!hose) return null;
    const isPremium = hose.gasTypeCode === 'premium';
    const borderColor = isPremium ? 'border-red-800/30' : 'border-slate-700/30';
    const focusColor = isPremium ? 'focus:border-red-500 focus:ring-red-500/20' : 'focus:border-slate-500 focus:ring-slate-500/20';
    const fromColor = isPremium ? 'from-red-950/50' : 'from-slate-800/50';
    const toColor = isPremium ? 'to-red-900/20' : 'to-slate-700/20';
    const textColor = isPremium ? 'text-red-400' : 'text-slate-300';
    const cashColor = isPremium ? 'text-red-300' : 'text-slate-200';
    const dotColor = isPremium ? 'bg-red-500' : 'bg-slate-400';
    const litersColor = isPremium ? 'text-red-600' : 'text-slate-500';

    return (
      <div className={`bg-linear-to-br ${fromColor} ${toColor} border ${borderColor} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${dotColor} shadow-lg`} />
            <span className={`${textColor} font-semibold`}>{label}</span>
            <span className="text-slate-500 text-sm">${prices[hose.gasTypeCode] || 0}/L</span>
          </div>
          <div className="text-right">
            <span className={`${cashColor} font-bold text-lg`}>${formatCurrency(cash)}</span>
            <span className={`${litersColor} text-xs block`}>{formatLiters(liters)}L</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Inicial</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={reading.start}
              onChange={(e) => handleInputChange(hose.id, 'start', e)}
              onBlur={() => handleBlur(hose.id, 'start', reading.start)}
              className={`h-12 bg-slate-900/50 ${borderColor} text-white text-lg font-medium placeholder:text-slate-600 ${focusColor}`}
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">Métrica Actual</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={reading.end}
              onChange={(e) => handleInputChange(hose.id, 'end', e)}
              onBlur={() => handleBlur(hose.id, 'end', reading.end)}
              className={`h-12 bg-slate-900/50 ${borderColor} text-white text-lg font-medium placeholder:text-slate-600 ${focusColor}`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden">
      {/* Pump Header */}
      <div className="bg-linear-to-r from-slate-800 to-slate-800/50 px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg">
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
        {renderFuelSection(regularHose, 'Regular', regularReading, regularLiters, regularCash)}
        {renderFuelSection(premiumHose, 'Premium', premiumReading, premiumLiters, premiumCash)}
      </div>
    </div>
  );
}
