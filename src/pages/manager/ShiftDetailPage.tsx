import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getJson, fetchBlob } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Clock,
  Banknote,
  Droplets,
  TrendingDown,
  Wallet,
  Receipt,
  Gauge,
  Users,
  ArrowLeft,
  Fuel,
  CreditCard,
  Ticket,
  FileDown,
  Loader2,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ShiftDetail {
  shift: {
    id: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
    managerName: string;
  };
  assignments: Array<{
    id: string;
    pumpId: string;
    dispatcherId: string;
    startedAt: string;
    endedAt: string | null;
    pumpNumber: number;
    pumpName: string;
    dispatcherName: string;
    totalSales: number;
    totalLiters: number;
    transactionCount: number;
  }>;
  transactions: Array<{
    id: string;
    recordedAt: string;
    type: 'Cash' | 'Card' | 'Credit';
    amount: number;
    liters: number | null;
    note: string | null;
    recordedByName: string;
    pumpNumber: number | null;
    creditCategoryName?: string;
  }>;
  withdrawals: Array<{
    id: string;
    recordedAt: string;
    amount: number;
    note: string;
    recordedByName: string;
  }>;
  readings: Array<{
    id: string;
    recordedAt: string;
    pumpNumber: number;
    gasTypeName: string;
    gasTypeCode: string;
    readingType: 'start' | 'end';
    value: number;
    recordedByName: string;
  }>;
  prices: Array<{
    gasTypeId: string;
    name: string;
    code: string;
    price: number;
  }>;
  salesByGasType: Array<{
    gasTypeId: string;
    gasTypeName: string;
    gasTypeCode: string;
    liters: number;
    pricePerLiter: number;
    sales: number;
  }>;
  summary: {
    totalSales: number;
    totalLiters: number;
    cardSales: number;
    creditSales: number;
    cashSales: number;
    totalWithdrawals: number;
    transactionCount: number;
    cashInHand: number;
  };
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatLiters(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
}

function formatDate(v: string) {
  return new Date(v).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTime(v: string) {
  return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  accentColor: string;
}

function StatCard({ title, value, icon: Icon, accentColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', accentColor)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!id || exporting) return;
    setExporting(true);
    try {
      const blob = await fetchBlob(`/reports/shifts/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `turno_${id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Reporte descargado');
    } catch (err: any) {
      toast.error(err.message || 'Error al generar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const { data, isLoading } = useQuery<ShiftDetail>({
    queryKey: ['shift-detail', id],
    queryFn: () => getJson(`/shifts/${id}/details`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Shift not found</p>
        <Link to="/manage/shifts">
          <Button variant="link" className="mt-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shift History
          </Button>
        </Link>
      </div>
    );
  }

  const creditTransactions = data.transactions.filter((t) => t.type === 'Credit');
  const creditByCategory = creditTransactions.reduce((acc, t) => {
    const key = t.creditCategoryName || 'Sin categoría';
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += Number(t.amount);
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const cardTransactions = data.transactions.filter((t) => t.type === 'Card');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/manage/shifts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Turno #{id?.slice(0, 8)}
            </h1>
            <p className="text-muted-foreground text-sm">
              {formatDate(data.shift.openedAt)}
              {data.shift.closedAt && ` — ${formatDate(data.shift.closedAt)}`}
            </p>
          </div>
          <Badge
            variant={data.shift.status === 'open' ? 'default' : 'secondary'}
            className={data.shift.status === 'open' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
          >
            {data.shift.status === 'open' ? 'Abierto' : 'Cerrado'}
          </Badge>
          {data.shift.status === 'closed' && (
            <Button
              onClick={handleExportPDF}
              disabled={exporting}
              size="sm"
              className="gap-2 bg-red-600 hover:bg-red-700 text-white ml-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Ventas Totales"
          value={`$${formatCurrency(data.summary.totalSales)}`}
          icon={Banknote}
          accentColor="bg-linear-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="Litros Despachados"
          value={`${formatLiters(data.summary.totalLiters)}L`}
          icon={Droplets}
          accentColor="bg-linear-to-br from-cyan-500 to-cyan-600"
        />
        <StatCard
          title="Efectivo"
          value={`$${formatCurrency(data.summary.cashInHand)}`}
          icon={Wallet}
          accentColor="bg-linear-to-br from-green-500 to-green-600"
        />
        <StatCard
          title="Retiros"
          value={`-$${formatCurrency(data.summary.totalWithdrawals)}`}
          icon={TrendingDown}
          accentColor="bg-linear-to-br from-slate-500 to-slate-600"
        />
      </div>

      {data.salesByGasType.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.salesByGasType.map((gt) => (
            <Card key={gt.gasTypeId} className="bg-linear-to-br from-slate-50 to-slate-100/50 border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Fuel className="w-5 h-5 text-slate-600" />
                  <p className="text-sm font-medium text-slate-700">{gt.gasTypeName}</p>
                </div>
                <p className="text-2xl font-bold text-slate-800 mt-2">${formatCurrency(gt.sales)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatLiters(gt.liters)}L × ${Number(gt.pricePerLiter).toFixed(2)}/L
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-linear-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-700">Efectivo (calculado)</p>
            </div>
            <p className="text-2xl font-bold text-green-800 mt-2">${formatCurrency(data.summary.cashSales)}</p>
            <p className="text-xs text-green-600 mt-1">Total - Tarjeta - Crédito</p>
          </CardContent>
        </Card>
        <Card className="bg-linear-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-blue-700">Ventas con Tarjeta</p>
            </div>
            <p className="text-2xl font-bold text-blue-800 mt-2">${formatCurrency(data.summary.cardSales)}</p>
            <p className="text-xs text-blue-600 mt-1">{cardTransactions.length} transacciones</p>
          </CardContent>
        </Card>
        <Card className="bg-linear-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-purple-700">Ventas a Crédito</p>
            </div>
            <p className="text-2xl font-bold text-purple-800 mt-2">${formatCurrency(data.summary.creditSales)}</p>
            <p className="text-xs text-purple-600 mt-1">{creditTransactions.length} transacciones</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Información del Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Transacciones</p>
            <p className="text-xl font-bold">{data.summary.transactionCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Encargado</p>
            <p className="text-xl font-bold">{data.shift.managerName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Asignaciones</p>
            <p className="text-xl font-bold">{data.assignments.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lecturas</p>
            <p className="text-xl font-bold">{data.readings.length}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50">
          <TabsTrigger value="assignments">
            <Users className="w-4 h-4 mr-2" />
            Asignaciones
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Receipt className="w-4 h-4 mr-2" />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            <TrendingDown className="w-4 h-4 mr-2" />
            Retiros
          </TabsTrigger>
          <TabsTrigger value="readings">
            <Gauge className="w-4 h-4 mr-2" />
            Lecturas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asignaciones de Bomba</CardTitle>
              <CardDescription>Despachadores asignados a cada bomba durante el turno</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium">Bomba</TableHead>
                    <TableHead className="font-medium">Despachador</TableHead>
                    <TableHead className="font-medium">Horario</TableHead>
                    <TableHead className="text-right font-medium">Ventas</TableHead>
                    <TableHead className="text-right font-medium">Litros</TableHead>
                    <TableHead className="text-right font-medium">Trans.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-red-500" />
                          <span className="font-medium">Bomba #{a.pumpNumber}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.pumpName}</p>
                      </TableCell>
                      <TableCell>{a.dispatcherName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm">{formatTime(a.startedAt)}</p>
                            {a.endedAt ? (
                              <p className="text-xs text-muted-foreground">{formatTime(a.endedAt)}</p>
                            ) : (
                              <p className="text-xs text-green-600 font-medium">Activo</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${formatCurrency(Number(a.totalSales))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatLiters(Number(a.totalLiters))}L
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.transactionCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen por Tipo de Pago</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">Efectivo</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-800">${formatCurrency(data.summary.cashSales)}</p>
                    <p className="text-xs text-green-600">calculado</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-700">Tarjeta</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-800">${formatCurrency(data.summary.cardSales)}</p>
                    <p className="text-xs text-blue-600">{cardTransactions.length} ventas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-700">Crédito</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-800">${formatCurrency(data.summary.creditSales)}</p>
                    <p className="text-xs text-purple-600">{creditTransactions.length} ventas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {Object.keys(creditByCategory).length > 0 && (
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-purple-600" />
                    Ventas a Crédito por Categoría
                  </CardTitle>
                  <CardDescription>Desglose de ventas a crédito agrupadas por programa/corporativo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-purple-50/50">
                        <TableHead className="font-medium text-purple-700">Categoría</TableHead>
                        <TableHead className="text-right font-medium text-purple-700">Transacciones</TableHead>
                        <TableHead className="text-right font-medium text-purple-700">Total</TableHead>
                        <TableHead className="text-right font-medium text-purple-700">Promedio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(creditByCategory).map(([category, data]) => (
                        <TableRow key={category}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-purple-500" />
                              <span className="font-medium">{category}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{data.count}</TableCell>
                          <TableCell className="text-right font-semibold text-purple-700">
                            ${formatCurrency(data.total)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${formatCurrency(data.total / data.count)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-purple-50/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{creditTransactions.length}</TableCell>
                        <TableCell className="text-right text-purple-700">
                          ${formatCurrency(data.summary.creditSales)}
                        </TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Todas las Transacciones</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Hora</TableHead>
                      <TableHead className="font-medium">Tipo</TableHead>
                      <TableHead className="font-medium">Bomba</TableHead>
                      <TableHead className="text-right font-medium">Monto</TableHead>
                      <TableHead className="text-right font-medium">Litros</TableHead>
                      <TableHead className="font-medium">Nota</TableHead>
                      <TableHead className="font-medium">Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">{formatTime(t.recordedAt)}</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'font-medium',
                              t.type === 'Cash' && 'bg-green-100 text-green-700',
                              t.type === 'Card' && 'bg-blue-100 text-blue-700',
                              t.type === 'Credit' && 'bg-purple-100 text-purple-700'
                            )}
                          >
                            {t.type === 'Cash' ? 'Efectivo' : t.type === 'Card' ? 'Tarjeta' : 'Crédito'}
                          </Badge>
                          {t.type === 'Credit' && t.creditCategoryName && (
                            <span className="ml-2 text-xs text-purple-600">({t.creditCategoryName})</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.pumpNumber ? `Bomba #${t.pumpNumber}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${formatCurrency(Number(t.amount))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {t.liters ? `${formatLiters(Number(t.liters))}L` : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.note || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{t.recordedByName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Retiros del Turno</CardTitle>
              <CardDescription>Montos retiradaos de la caja durante el turno</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium">Hora</TableHead>
                    <TableHead className="font-medium">Nota</TableHead>
                    <TableHead className="text-right font-medium">Monto</TableHead>
                    <TableHead className="font-medium">Registrado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {formatTime(w.recordedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{w.note}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -${formatCurrency(Number(w.amount))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{w.recordedByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lecturas de Medidores</CardTitle>
              <CardDescription>Registros iniciales y finales de los medidores de cada bomba</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium">Bomba</TableHead>
                    <TableHead className="font-medium">Combustible</TableHead>
                    <TableHead className="font-medium">Tipo</TableHead>
                    <TableHead className="text-right font-medium">Valor</TableHead>
                    <TableHead className="font-medium">Hora</TableHead>
                    <TableHead className="font-medium">Registrado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.readings.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-red-500" />
                          <span className="font-medium">Bomba #{r.pumpNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              r.gasTypeCode === 'premium' ? 'bg-red-500' : 'bg-slate-400'
                            )}
                          />
                          {r.gasTypeName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'font-medium',
                            r.readingType === 'start' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {r.readingType === 'start' ? 'Inicial' : 'Final'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatLiters(Number(r.value))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatTime(r.recordedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.recordedByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
