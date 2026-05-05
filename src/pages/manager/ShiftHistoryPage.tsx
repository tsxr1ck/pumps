import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getJson } from '@/lib/api';
import {
  Clock,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Shift } from '@/types';

function formatTime(v: string) {
  return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function ShiftHistoryPage() {
  const { data: listData, isLoading } = useQuery<{ shifts: Shift[] }>({
    queryKey: ['shifts'],
    queryFn: () => getJson('/shifts'),
  });

  const shifts = listData?.shifts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historial de Turnos</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Selecciona un turno para ver los detalles</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin turnos registrados</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Los turnos cerrados aparecerán aquí para su revisión.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Turnos</CardTitle>
            <CardDescription>{shifts.length} turnos registrados</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium whitespace-nowrap">Turno</TableHead>
                  <TableHead className="font-medium whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="font-medium whitespace-nowrap">Horario</TableHead>
                  <TableHead className="font-medium whitespace-nowrap">Estado</TableHead>
                  <TableHead className="font-medium whitespace-nowrap">Asign.</TableHead>
                  <TableHead className="text-right font-medium whitespace-nowrap">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-slate-600" />
                        </div>
                        <span className="font-semibold text-foreground">
                          #{shift.id.slice(0, 8)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {new Date(shift.openedAt).toLocaleDateString('es-ES', { dateStyle: 'medium' })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="text-foreground">{formatTime(shift.openedAt)}</span>
                        {shift.closedAt && (
                          <span className="text-muted-foreground text-xs">
                            → {formatTime(shift.closedAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={shift.status === 'open' ? 'default' : 'secondary'}
                        className={shift.status === 'open' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                      >
                        {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {shift.assignments?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/manage/shifts/${shift.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          Ver detalle
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
