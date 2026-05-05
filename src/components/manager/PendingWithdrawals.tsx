import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getJson, patchJson } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  X,
  Check,
  AlertCircle,
  Receipt,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Transaction } from '@/types';

interface PendingWithdrawal {
  withdrawal: {
    id: string;
    shift_id: string;
    amount: number;
    note: string;
    status: 'pending' | 'approved' | 'rejected';
    recorded_at: string;
    recordedByName: string;
    coveredTransactionCount: number;
    coveredAmount: number;
    latestTransactionAt: string | null;
  };
  coveredTransactions: Array<Transaction & { recordedByName: string; pumpNumber: number | null }>;
}

interface PendingWithdrawalsProps {
  shiftId: string | null;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatTime(v: string) {
  return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getTransactionBadge(type: string) {
  switch (type) {
    case 'Card': return <Badge className="bg-blue-900/50 text-blue-400 text-xs">Tarjeta</Badge>;
    case 'Credit': return <Badge className="bg-purple-900/50 text-purple-400 text-xs">Crédito</Badge>;
    default: return <Badge className="bg-emerald-900/50 text-emerald-400 text-xs">Efectivo</Badge>;
  }
}

function PendingWithdrawalCard({
  data,
  onApprove,
  onReject,
  isProcessing,
}: {
  data: PendingWithdrawal;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  isProcessing: boolean;
}) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const { withdrawal, coveredTransactions } = data;

  return (
    <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Retiro Pendiente</h3>
              <p className="text-sm text-muted-foreground">
                {withdrawal.recordedByName} • {formatTime(withdrawal.recorded_at)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-semibold">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Monto Total</span>
            <span className="text-2xl font-bold text-amber-500">
              ${formatCurrency(Number(withdrawal.amount))}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Despachador: {withdrawal.recordedByName}</span>
          </div>
          {withdrawal.note && withdrawal.note !== 'Retiro' && (
            <div className="mt-2 text-sm text-slate-400">
              Nota: {withdrawal.note}
            </div>
          )}
        </div>

        {coveredTransactions.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {coveredTransactions.length} transacciones incluidas
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {coveredTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs bg-slate-800/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {getTransactionBadge(tx.type)}
                    <span className="text-slate-300">
                      {tx.type === 'Card' ? `****${tx.cardLast4 || ''}` : tx.note || tx.type}
                    </span>
                  </div>
                  <span className="text-white font-medium">${formatCurrency(Number(tx.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showRejectForm ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectForm(true)}
              className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Rechazar
            </Button>
            <Button
              onClick={() => onApprove(withdrawal.id)}
              disabled={isProcessing}
              className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold"
            >
              <Check className="w-4 h-4 mr-2" />
              {isProcessing ? 'Procesando...' : 'Aprobar'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Razón del rechazo (opcional)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                className="flex-1 h-10"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => { onReject(withdrawal.id, rejectNote); setShowRejectForm(false); }}
                disabled={isProcessing}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PendingWithdrawals({ shiftId }: PendingWithdrawalsProps) {
  const [pendingList, setPendingList] = useState<PendingWithdrawal[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const { subscribe } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (shiftId) {
      getJson<{ withdrawals: any[] }>(`/withdrawals/pending?shift_id=${shiftId}`)
        .then((data) => {
          const mapped = data.withdrawals.map((w: any) => ({
            withdrawal: {
              id: w.id,
              shift_id: w.shift_id,
              amount: w.amount,
              note: w.note,
              status: w.status,
              recorded_at: w.recorded_at,
              recordedByName: w.recorded_by_name,
              coveredTransactionCount: 0,
              coveredAmount: 0,
              latestTransactionAt: null,
            },
            coveredTransactions: [],
          }));
          setPendingList(mapped);
        })
        .catch(() => {});
    }
  }, [shiftId]);

  useEffect(() => {
    const unsub = subscribe('withdrawal:created', (data: any) => {
      if (data?.withdrawal?.shift_id === shiftId) {
        setPendingList((prev) => [{
          withdrawal: {
            ...data.withdrawal,
            recorded_at: data.withdrawal.recorded_at || new Date().toISOString(),
          },
          coveredTransactions: data.coveredTransactions || [],
        }, ...prev]);
        toast.warning(
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Nuevo Retiro Pendiente</p>
            <p className="text-sm">${formatCurrency(Number(data.withdrawal.amount))} - Esperando aprobación</p>
          </div>,
          { duration: 8000, icon: '💰' }
        );
      }
    });

    const unsub2 = subscribe('withdrawal:updated', (data: any) => {
      if (data?.withdrawal?.status !== 'pending') {
        setPendingList((prev) => prev.filter((p) => p.withdrawal.id !== data.withdrawal.id));
        if (data.withdrawal.status === 'approved') {
          toast.success(<>Retiro <strong>#{data.withdrawal.id.slice(0, 8)}</strong> aprobado</>);
        } else if (data.withdrawal.status === 'rejected') {
          toast.info(<>Retiro <strong>#{data.withdrawal.id.slice(0, 8)}</strong> rechazado</>);
        }
      }
    });

    return () => { unsub(); unsub2(); };
  }, [subscribe, shiftId]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => patchJson(`/withdrawals/${id}/approve`, { status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
    onError: () => {
      toast.error('Error al aprobar retiro');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      patchJson(`/withdrawals/${id}/approve`, { status: 'rejected', rejectionNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
    onError: () => {
      toast.error('Error al rechazar retiro');
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

  if (pendingList.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 w-80 z-40 space-y-3">
      <div className="flex items-center gap-2 px-2">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-500">
          {pendingList.length} retiro{pendingList.length !== 1 ? 's' : ''} pendiente{pendingList.length !== 1 ? 's' : ''}
        </span>
      </div>
      {pendingList.map((item) => (
        <PendingWithdrawalCard
          key={item.withdrawal.id}
          data={item}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={processingIds.has(item.withdrawal.id)}
        />
      ))}
    </div>
  );
}
