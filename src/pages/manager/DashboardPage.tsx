import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, patchJson } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Banknote,
  Droplets,
  TrendingDown,
  Wallet,
  Fuel,
  Plus,
  X,
  RefreshCw,
  Clock,
  TrendingUp,
  CreditCard,
  Ticket,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardSummary, Pump, User } from '@/types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatLiters(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
}

function formatTime(v: string) {
  return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  accentColor: string;
  className?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, accentColor, className }: MetricCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', accentColor)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1', trend.positive ? 'text-green-600' : 'text-red-600')}>
                <TrendingUp className={cn('w-3 h-3', !trend.positive && 'rotate-180')} />
                <span className="text-xs font-medium">{trend.value}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ShiftCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pumps: Pump[];
  dispatchers: User[];
  assignments: Record<string, string>;
  shiftNotes: string;
  onAssignmentChange: (pumpId: string, dispatcherId: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

function ShiftCreateDialog({
  open,
  onOpenChange,
  pumps,
  dispatchers,
  assignments,
  shiftNotes,
  onAssignmentChange,
  onNotesChange,
  onSubmit,
  isPending,
}: ShiftCreateDialogProps) {
  const assignedCount = Object.values(assignments).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-red-600" />
            </div>
            Nuevo Turno
          </DialogTitle>
          <DialogDescription>
            Asigna un despachador a cada bomba que estará activa en este turno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {pumps.map((pump) => (
            <div key={pump.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <Fuel className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Bomba #{pump.number}</p>
                <p className="text-xs text-muted-foreground truncate">{pump.name}</p>
              </div>
              <Select
                value={assignments[pump.id] || ''}
                onValueChange={(value) => onAssignmentChange(pump.id, value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Notas (opcional)</label>
          <input
            type="text"
            value={shiftNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Notas sobre el turno..."
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || assignedCount === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? 'Abriendo...' : `Abrir Turno (${assignedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pumpNumber: number;
  dispatchers: User[];
  currentDispatcherName: string;
  onReassign: (dispatcherId: string) => void;
  isPending: boolean;
}

function ReassignDialog({
  open,
  onOpenChange,
  pumpNumber,
  dispatchers,
  currentDispatcherName,
  onReassign,
  isPending,
}: ReassignDialogProps) {
  const [selectedId, setSelectedId] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reasignar Bomba #{pumpNumber}</DialogTitle>
          <DialogDescription>
            Actual despachador: <span className="font-medium text-foreground">{currentDispatcherName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar despachador..." />
            </SelectTrigger>
            <SelectContent>
              {dispatchers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onReassign(selectedId)}
            disabled={isPending || !selectedId}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? 'Reasignando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { subscribe } = useSocket();
  const [creatingShift, setCreatingShift] = useState(false);
  const [reassigningPump, setReassigningPump] = useState<{ pumpId: string; pumpNumber: number; dispatcherName: string } | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [shiftNotes, setShiftNotes] = useState('');

  const { data, refetch } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => getJson('/dashboard/summary'),
    refetchInterval: 15000,
  });

  const { data: pumpsData } = useQuery<{ pumps: Pump[] }>({
    queryKey: ['pumps'],
    queryFn: () => getJson('/pumps'),
    enabled: creatingShift || !!reassigningPump,
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => getJson('/users'),
    enabled: creatingShift || !!reassigningPump,
  });

  const summary = data;
  const pumps = pumpsData?.pumps || [];
  const dispatchers = usersData?.users?.filter((u) => u.role === 'Dispatcher' && u.isActive) || [];

  useEffect(() => {
    const unsub1 = subscribe('withdrawal:created', () => refetch());
    const unsub2 = subscribe('reading:updated', () => refetch());
    const unsub3 = subscribe('assignment:changed', () => refetch());
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe, refetch]);

  const createShiftMutation = useMutation({
    mutationFn: (body: { assignments: { pumpId: string; dispatcherId: string }[]; notes?: string }) =>
      postJson('/shifts', body),
    onSuccess: () => {
      toast.success('Turno abierto exitosamente');
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      setCreatingShift(false);
      setAssignments({});
      setShiftNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error abriendo turno');
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: (shiftId: string) => patchJson(`/shifts/${shiftId}/close`, {}),
    onSuccess: () => {
      toast.success('Turno cerrado');
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error cerrando turno');
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({ shiftId, pumpId, dispatcherId }: { shiftId: string; pumpId: string; dispatcherId: string }) =>
      postJson(`/shifts/${shiftId}/assignments`, { pumpId, dispatcherId }),
    onSuccess: () => {
      toast.success('Bomba reasignada');
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      setReassigningPump(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error reasignando bomba');
    },
  });

  const handleAssignmentChange = (pumpId: string, dispatcherId: string) => {
    setAssignments((prev) => ({ ...prev, [pumpId]: dispatcherId }));
  };

  const handleCreateShift = () => {
    const shiftAssignments = Object.entries(assignments)
      .filter(([, dispatcherId]) => dispatcherId)
      .map(([pumpId, dispatcherId]) => ({ pumpId, dispatcherId }));

    if (shiftAssignments.length === 0) {
      toast.error('Asigna al menos un despachador a una bomba');
      return;
    }

    createShiftMutation.mutate({
      assignments: shiftAssignments,
      notes: shiftNotes || undefined,
    });
  };

  const handleReassign = (dispatcherId: string) => {
    if (!summary?.shiftId || !reassigningPump) return;
    reassignMutation.mutate({
      shiftId: summary.shiftId,
      pumpId: reassigningPump.pumpId,
      dispatcherId,
    });
  };

  const isShiftOpen = !!summary?.shiftId;

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Resumen del turno activo</p>
        </div>
        {isShiftOpen ? (
          <Button
            onClick={() => summary?.shiftId && closeShiftMutation.mutate(summary.shiftId)}
            disabled={closeShiftMutation.isPending}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <X className="w-4 h-4 mr-2" />
            {closeShiftMutation.isPending ? 'Cerrando...' : 'Cerrar Turno'}
          </Button>
        ) : (
          <Button
            onClick={() => setCreatingShift(true)}
            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Abrir Turno
          </Button>
        )}
      </div>

      {!isShiftOpen && !creatingShift && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Fuel className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No hay turno activo</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Abre un nuevo turno para ver las métricas en tiempo real y gestionar las bombas.
            </p>
            <Button
              onClick={() => setCreatingShift(true)}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Abrir Turno
            </Button>
          </CardContent>
        </Card>
      )}

      {isShiftOpen && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Efectivo en Mano"
              value={`$${formatCurrency(summary.cashInHand)}`}
              icon={Wallet}
              accentColor="bg-gradient-to-br from-red-500 to-red-600"
            />
            <MetricCard
              title="Ventas Totales"
              value={`$${formatCurrency(summary.totalSales)}`}
              icon={Banknote}
              accentColor="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <MetricCard
              title="Retiros"
              value={`-$${formatCurrency(summary.totalWithdrawals)}`}
              subtitle={`${summary.recentWithdrawals?.length || 0} retiros`}
              icon={TrendingDown}
              accentColor="bg-gradient-to-br from-slate-500 to-slate-600"
            />
            <MetricCard
              title="Litros Totales"
              value={`${formatLiters(summary.totalLiters)}L`}
              icon={Droplets}
              accentColor="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-linear-to-br from-green-50 to-green-100/50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Banknote className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-green-700">Efectivo (calculado)</p>
                </div>
                <p className="text-2xl font-bold text-green-800 mt-2">${formatCurrency(summary.cashSales)}</p>
                <p className="text-xs text-green-600 mt-1">Total - Tarjeta - Crédito</p>
              </CardContent>
            </Card>
            <Card className="bg-linear-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-700">Ventas con Tarjeta</p>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-2">${formatCurrency(summary.cardSales)}</p>
              </CardContent>
            </Card>
            <Card className="bg-linear-to-br from-purple-50 to-purple-100/50 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-700">Ventas a Crédito</p>
                </div>
                <p className="text-2xl font-bold text-purple-800 mt-2">${formatCurrency(summary.creditSales)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center">
                    <Fuel className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  Asignaciones Activas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.pumpStats?.length > 0 ? (
                  summary.pumpStats.map((pump: any) => (
                    <div
                      key={pump.pumpId}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                          <Fuel className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Bomba #{pump.pumpNumber}</p>
                          <p className="text-xs text-muted-foreground">{pump.dispatcherName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">${formatCurrency(Number(pump.totalSales))}</p>
                          <p className="text-xs text-muted-foreground">{formatLiters(Number(pump.totalLiters))}L</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setReassigningPump({
                              pumpId: pump.pumpId,
                              pumpNumber: pump.pumpNumber,
                              dispatcherName: pump.dispatcherName,
                            })
                          }
                        >
                          <RefreshCw className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Sin asignaciones activas</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                    <TrendingDown className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  Retiros Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.recentWithdrawals?.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {summary.recentWithdrawals.map((w: any) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{w.note}</p>
                          <p className="text-xs text-muted-foreground">
                            {w.recordedByName} • {new Date(w.recordedAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-red-600 ml-4">
                          -${formatCurrency(Number(w.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Sin retiros registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {summary.assignmentStats && summary.assignmentStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por Periodo de Asignación</CardTitle>
                <CardDescription>
                  Cada fila muestra las ventas atribuidas a un despachador durante su ventana de tiempo asignada.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium whitespace-nowrap">Bomba</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Despachador</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Desde</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Hasta</TableHead>
                      <TableHead className="text-right font-medium whitespace-nowrap">Ventas</TableHead>
                      <TableHead className="text-right font-medium whitespace-nowrap">Litros</TableHead>
                      <TableHead className="text-right font-medium whitespace-nowrap">Trans.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.assignmentStats.map((a: any) => (
                      <TableRow key={a.assignmentId}>
                        <TableCell className="font-medium">Bomba #{a.pumpNumber}</TableCell>
                        <TableCell>{a.dispatcherName}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTime(a.startedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {a.endedAt ? (
                            formatTime(a.endedAt)
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 font-medium">
                              Activo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${formatCurrency(Number(a.totalSales))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatLiters(Number(a.totalLiters))}L
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {a.transactionCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ShiftCreateDialog
        open={creatingShift}
        onOpenChange={setCreatingShift}
        pumps={pumps}
        dispatchers={dispatchers}
        assignments={assignments}
        shiftNotes={shiftNotes}
        onAssignmentChange={handleAssignmentChange}
        onNotesChange={setShiftNotes}
        onSubmit={handleCreateShift}
        isPending={createShiftMutation.isPending}
      />

      <ReassignDialog
        open={!!reassigningPump}
        onOpenChange={(open) => !open && setReassigningPump(null)}
        pumpNumber={reassigningPump?.pumpNumber || 0}
        dispatchers={dispatchers}
        currentDispatcherName={reassigningPump?.dispatcherName || ''}
        onReassign={handleReassign}
        isPending={reassignMutation.isPending}
      />
    </div>
  );
}
