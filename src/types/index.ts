export interface User {
  id: string;
  numericId: number;
  name: string;
  role: "Manager" | "Cashier" | "Dispatcher";
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GasType {
  id: string;
  name: string;
  code: string;
}

export interface Hose {
  id: string;
  pumpId: string;
  gasTypeId: string;
  side: string;
  isActive: boolean;
  gasTypeName: string;
  gasTypeCode: string;
}

export interface Pump {
  id: string;
  number: number;
  name: string;
  isActive: boolean;
  hoses: Hose[];
}

export interface ShiftAssignment {
  id: string;
  pumpId: string;
  dispatcherId: string;
  dispatcherName: string;
  startedAt: string;
  endedAt: string | null;
}

export interface Shift {
  id: string;
  managerId: string;
  managerName?: string;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
  notes: string | null;
  assignments: ShiftAssignment[];
}

export interface AssignmentStat {
  assignmentId: string;
  pumpNumber: number;
  pumpId: string;
  dispatcherId: string;
  dispatcherName: string;
  startedAt: string;
  endedAt: string | null;
  totalSales: number;
  totalLiters: number;
  transactionCount: number;
}

export interface MeterReading {
  id: string;
  shiftId: string;
  hoseId: string;
  readingType: 'start' | 'end';
  value: number;
  recordedBy: string;
  recordedByName?: string;
  recordedAt: string;
  pumpId?: string;
  pumpNumber?: number;
  gasTypeName?: string;
  gasTypeCode?: string;
}

export type TransactionType = "Cash" | "Card" | "Credit";

export interface Transaction {
  id: string;
  shiftId: string;
  pumpId: string | null;
  type: TransactionType;
  amount: number;
  liters: number | null;
  cardLast4: string | null;
  creditCategoryId: string | null;
  note: string | null;
  recordedBy: string;
  recordedByName?: string;
  recordedAt: string;
  withdrawalId?: string | null;
  pumpNumber?: number | null;
  creditCategoryName?: string | null;
}

export interface Withdrawal {
  id: string;
  shiftId: string;
  amount: number;
  note: string;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
  coveredTransactionCount?: number;
  coveredAmount?: number;
  latestTransactionAt?: string | null;
}

export interface GasPrice {
  id: string;
  gasTypeId: string;
  price: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  setBy: string;
  setByName?: string;
  name?: string;
  code?: string;
  gasTypeName?: string;
  gasTypeCode?: string;
}

export interface CreditCategory {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
}

export interface DashboardSummary {
  shiftId: string | null;
  totalSales: number;
  totalLiters: number;
  totalWithdrawals: number;
  cashInHand: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  regularLiters: number;
  premiumLiters: number;
  regularCash: number;
  premiumCash: number;
  transactionsByType: Array<{ type: TransactionType; total_amount: number; total_liters: number }>;
  pumpStats: Array<{
    pumpNumber: number;
    pumpId: string;
    dispatcherId: string;
    dispatcherName: string;
    totalSales: number;
    totalLiters: number;
  }>;
  assignmentStats: AssignmentStat[];
  recentWithdrawals: Withdrawal[];
  unwithdrawnCash: number;
  unwithdrawnTransactionCount: number;
  unwithdrawnNonCash: number;
  unwithdrawnNonCashCount: number;
}
