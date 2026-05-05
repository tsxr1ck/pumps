import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, patchJson } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  Check,
  X,
  Clock,
  Receipt,
  Banknote,
  CreditCard,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Transaction, Withdrawal } from '@/types';

interface WithdrawalWithDetails {
  withdrawal: Withdrawal & {
    recorded_by_name: string;
    approved_by_name?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_note?: string;
    cashAmount?: number;
    nonCashAmount?: number;
    nonCashCount?: number;
    coveredTransactionCount?: number;
    coveredAmount?: number;
  };
  coveredTransactions: Array<Transaction & {
    recorded_by_name: string;
    pump_number: number | null;
    card_last4?: string;
    credit_category_name?: string;
  }>;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatTime(v: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(v: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-ES', { dateStyle: 'medium' });
}

function getTransactionBadge(type: string) {
  switch (type) {
    case 'Card': return <Badge className="bg-blue-900/50 text-blue-400">Tarjeta</Badge>;
    case 'Credit': return <Badge className="bg-purple-900/50 text-purple-400">Crédito</Badge>;
    default: return <Badge className="bg-emerald-900/50 text-emerald-400">Efectivo</Badge>;
  }
}

function PendingCard({
  data,
  onApprove,
  onReject,
  isProcessing,
}: {
  data: WithdrawalWithDetails;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  isProcessing: boolean;
}) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const { withdrawal, coveredTransactions } = data;

  const cashTxs = coveredTransactions.filter((t) => t.type === 'Cash');
  const cardTxs = coveredTransactions.filter((t) => t.type === 'Card');
  const creditTxs = coveredTransactions.filter((t) => t.type === 'Credit');

  const cashTotal = cashTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const cardTotal = cardTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const creditTotal = creditTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <Card className="border-amber-500/30 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Retiro #{withdrawal.id?.slice(0, 8)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatDate(withdrawal.recordedAt)} • {formatTime(withdrawal.recordedAt)}
                </span>
              </div>
            </div>
          </div>
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-semibold">
            Pendiente
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Solicitado por</span>
            </div>
            <span className="font-semibold">{withdrawal.recordedByName}</span>
          </div>
          {withdrawal.note && withdrawal.note !== 'Retiro' && (
            <div className="text-sm text-muted-foreground mb-3 pl-6">
              Nota: {withdrawal.note}
            </div>
          )}
          <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-slate-700">
            <span className="text-lg font-medium">Monto Total</span>
            <span className="text-2xl font-bold text-amber-600">
              ${formatCurrency(Number(withdrawal.amount))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Efectivo</span>
            </div>
            <p className="text-lg font-bold text-emerald-700">${formatCurrency(cashTotal)}</p>
            <p className="text-xs text-emerald-600">{cashTxs.length} ops</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Tarjeta</span>
            </div>
            <p className="text-lg font-bold text-blue-700">${formatCurrency(cardTotal)}</p>
            <p className="text-xs text-blue-600">{cardTxs.length} ops</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Crédito</span>
            </div>
            <p className="text-lg font-bold text-purple-700">${formatCurrency(creditTotal)}</p>
            <p className="text-xs text-purple-600">{creditTxs.length} ops</p>
          </div>
        </div>

        {coveredTransactions.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Transacciones ({coveredTransactions.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {coveredTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {getTransactionBadge(tx.type)}
                    <span className="text-foreground text-xs">
                      {tx.type === 'Card' ? `****${tx.card_last4 || ''}` : tx.note || tx.type}
                    </span>
                  </div>
                  <span className="font-medium">${formatCurrency(Number(tx.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showRejectForm ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRejectForm(true)}
              className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Rechazar
            </Button>
            <Button
              onClick={() => onApprove(withdrawal.id!)}
              disabled={isProcessing}
              className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold"
            >
              <Check className="w-4 h-4 mr-2" />
              {isProcessing ? 'Procesando...' : 'Aprobar'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Razón del rechazo (opcional)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => { onReject(withdrawal.id!, rejectNote); setShowRejectForm(false); }}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WithdrawalApprovalPage() {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const { subscribe } = useSocket();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ withdrawals: any[] }>({
    queryKey: ['withdrawals-pending'],
    queryFn: () => getJson('/withdrawals/pending'),
    refetchInterval: 10000,
  });

  const [withdrawalDetails, setWithdrawalDetails] = useState<WithdrawalWithDetails[]>([]);

  useEffect(() => {
    if (data?.withdrawals) {
      Promise.all(
        data.withdrawals.map(async (w: any) => {
          try {
            const txData = await getJson<{ transactions: any[] }>(`/withdrawals/${w.id}/transactions`);
            return {
              withdrawal: {
                ...w,
                status: w.status || 'pending',
                recorded_at: w.recorded_at,
              },
              coveredTransactions: txData.transactions || [],
            };
          } catch {
            return {
              withdrawal: {
                ...w,
                status: w.status || 'pending',
                recorded_at: w.recorded_at,
              },
              coveredTransactions: [],
            };
          }
        })
      ).then(setWithdrawalDetails);
    }
  }, [data]);

  useEffect(() => {
    const unsub = subscribe('withdrawal:created', (data: any) => {
      if (data?.withdrawal?.status === 'pending') {
        queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
        toast.info(
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Nuevo Retiro Pendiente</p>
            <p className="text-sm">${formatCurrency(Number(data.withdrawal.amount))}</p>
          </div>,
          { duration: 5000 }
        );
      }
    });

    const unsub2 = subscribe('withdrawal:updated', (data: any) => {
      if (data?.withdrawal?.status !== 'pending') {
        queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
        if (data.withdrawal.status === 'approved') {
          toast.success(<>Retiro <strong>#{data.withdrawal.id?.slice(0, 8)}</strong> aprobado</>);
        } else if (data.withdrawal.status === 'rejected') {
          toast.info(<>Retiro <strong>#{data.withdrawal.id?.slice(0, 8)}</strong> rechazado</>);
        }
      }
    });

    return () => { unsub(); unsub2(); };
  }, [subscribe, queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => patchJson(`/withdrawals/${id}/approve`, { status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
    },
    onError: () => {
      toast.error('Error al aprobar');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      patchJson(`/withdrawals/${id}/approve`, { status: 'rejected', rejectionNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
    },
    onError: () => {
      toast.error('Error al rechazar');
    },
  });

  const handleApprove = (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    approveMutation.mutate(id, {
      onSettled: () => {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const handleReject = (id: string, note: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    rejectMutation.mutate({ id, note }, {
      onSettled: () => {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aprobación de Retiros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {withdrawalDetails.length} retiro{withdrawalDetails.length !== 1 ? 's' : ''} pendiente{withdrawalDetails.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : withdrawalDetails.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin retiros pendientes</h3>
            <p className="text-muted-foreground text-sm text-center">
              Los retiros pendientes aparecerán aquí para su revisión.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {withdrawalDetails.map((item) => (
            <PendingCard
              key={item.withdrawal.id}
              data={item}
              onApprove={handleApprove}
              onReject={handleReject}
              isProcessing={processingIds.has(item.withdrawal.id!)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
