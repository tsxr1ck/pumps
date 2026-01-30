import { useState, useEffect, useRef, type JSX } from 'react';
import { Settings, ChevronLeft, ChevronRight, RotateCcw, Fuel } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Dashboard from '@/components/dashboard';
import PumpCard from '@/components/pump-card';
import WithdrawalManager from '@/components/withdrawal-manager';
import SettingsDrawer from '@/components/settings-drawer';
import ShareButton from '@/components/share-button';

const STORAGE_KEY = 'gas-station-monitor';

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

interface Withdrawal {
  id: string | number;
  amount: number;
  note: string;
  timestamp: string;
}

type NewWithdrawal = Omit<Withdrawal, 'id'>;

interface HomeState {
  prices: Prices;
  pumps: Pump[];
  withdrawals: Withdrawal[];
}

const initialPumpState = (): Pump => ({
  regular: { initial: '', current: '' },
  premium: { initial: '', current: '' }
});

const initialState: HomeState = {
  prices: { regular: 0, premium: 0 },
  pumps: [initialPumpState(), initialPumpState(), initialPumpState(), initialPumpState()],
  withdrawals: []
};

export default function Home(): JSX.Element {
  const [state, setState] = useState<HomeState>(initialState);
  const [currentPump, setCurrentPump] = useState<number>(0);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HomeState;
        setState(parsed);
      } catch (e) {
        console.error('Failed to parse saved state');
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const updatePump = (pumpIndex: number, fuelType: FuelType, field: Field, value: string): void => {
    setState(prev => {
      const newPumps = [...prev.pumps];
      newPumps[pumpIndex] = {
        ...newPumps[pumpIndex],
        [fuelType]: {
          ...newPumps[pumpIndex][fuelType],
          [field]: value
        }
      } as Pump;
      return { ...prev, pumps: newPumps };
    });
  };

  const updatePrices = (prices: Prices): void => {
    setState(prev => ({ ...prev, prices }));
  };

  const addWithdrawal = (withdrawal: NewWithdrawal): void => {
    setState(prev => ({
      ...prev,
      withdrawals: [...prev.withdrawals, { ...withdrawal, id: Date.now() }]
    }));
  };

  const removeWithdrawal = (id: string | number): void => {
    setState(prev => ({
      ...prev,
      withdrawals: prev.withdrawals.filter(w => w.id !== id)
    }));
  };

  const startNewShift = () => {
    if (confirm('¿Iniciar un nuevo turno? Las métricas actuales se convertirán en métricas iniciales.')) {
      setState(prev => ({
        ...prev,
        pumps: prev.pumps.map(pump => ({
          regular: {
            initial: pump.regular.current || pump.regular.initial || '',
            current: ''
          },
          premium: {
            initial: pump.premium.current || pump.premium.initial || '',
            current: ''
          }
        })),
        withdrawals: []
      }));
    }
  };

  // Calculate totals
  const calculateLiters = (initial: string, current: string): number => {
    const i = parseFloat(initial) || 0;
    const c = parseFloat(current) || 0;
    return Math.max(0, c - i);
  };

  const totals = state.pumps.reduce((acc, pump) => {
    const regularLiters = calculateLiters(pump.regular.initial, pump.regular.current);
    const premiumLiters = calculateLiters(pump.premium.initial, pump.premium.current);
    
    return {
      regularLiters: acc.regularLiters + regularLiters,
      premiumLiters: acc.premiumLiters + premiumLiters,
      regularCash: acc.regularCash + (regularLiters * state.prices.regular),
      premiumCash: acc.premiumCash + (premiumLiters * state.prices.premium)
    };
  }, { regularLiters: 0, premiumLiters: 0, regularCash: 0, premiumCash: 0 } as { regularLiters: number; premiumLiters: number; regularCash: number; premiumCash: number });

  const totalSales = totals.regularCash + totals.premiumCash;
  const totalLiters = totals.regularLiters + totals.premiumLiters;
  const totalWithdrawals = state.withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
  const cashInHand = totalSales - totalWithdrawals;

  const goToPump = (index: number) => {
    setCurrentPump(index);
  };

  const nextPump = () => setCurrentPump(prev => Math.min(3, prev + 1));
  const prevPump = () => setCurrentPump(prev => Math.max(0, prev - 1));

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-white">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className='flex flex-col max-w-xl md:max-x-full w-full flex-1'>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Monitor de Combustible</h1>
              <p className="text-xs text-slate-500">Control de Ventas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <ShareButton targetRef={dashboardRef} className="text-slate-400 hover:text-white hover:bg-slate-800" />
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewShift}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <div ref={dashboardRef} className="relative px-4">
        <Dashboard
          totalSales={totalSales}
          totalLiters={totalLiters}
          totalWithdrawals={totalWithdrawals}
          cashInHand={cashInHand}
          regularLiters={totals.regularLiters}
          premiumLiters={totals.premiumLiters}
          regularCash={totals.regularCash}
          premiumCash={totals.premiumCash}
        />
      </div>

      {/* Pump Carousel */}
      <div className="px-4 py-6">
        {/* Pump Indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              onClick={() => goToPump(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentPump === index 
                  ? 'w-8 bg-emerald-500' 
                  : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Carousel Container */}
        <div className="relative">
          <div 
            ref={carouselRef}
            className="overflow-hidden rounded-2xl"
          >
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentPump * 100}%)` }}
            >
              {state.pumps.map((pump, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <PumpCard
                    pumpNumber={index + 1}
                    pump={pump}
                    prices={state.prices}
                    onUpdate={(fuelType, field, value) => updatePump(index, fuelType, field, value)}
                    calculateLiters={calculateLiters}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevPump}
            disabled={currentPump === 0}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all ${
              currentPump === 0 ? 'opacity-30' : 'opacity-100 hover:bg-slate-700'
            }`}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={nextPump}
            disabled={currentPump === 3}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all ${
              currentPump === 3 ? 'opacity-30' : 'opacity-100 hover:bg-slate-700'
            }`}
          >
           
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Pump Label */}
        <p className="text-center text-slate-500 text-sm mt-3">
          Bomba {currentPump + 1} de 4
        </p>
      </div>

      {/* Withdrawals Section */}
      <WithdrawalManager
        withdrawals={state.withdrawals}
        onAdd={addWithdrawal}
        onRemove={removeWithdrawal}
        totalWithdrawals={totalWithdrawals}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prices={state.prices}
        onUpdatePrices={updatePrices}
      />

      </div>
    </div>
  );
}