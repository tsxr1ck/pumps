import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '@/lib/api';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GasPrice } from '@/types';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function PricesPage() {
  const queryClient = useQueryClient();
  const [selectedGasType, setSelectedGasType] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const { data: currentData } = useQuery<{ prices: GasPrice[] }>({
    queryKey: ['prices-current'],
    queryFn: () => getJson('/prices/current'),
  });

  const { data: historyData } = useQuery<{ prices: GasPrice[] }>({
    queryKey: ['prices-history'],
    queryFn: () => getJson('/prices'),
  });

  const setPriceMutation = useMutation({
    mutationFn: (body: { gasTypeId: string; price: number }) => postJson('/prices', body),
    onSuccess: () => {
      toast.success('Precio actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['prices-current'] });
      queryClient.invalidateQueries({ queryKey: ['prices-history'] });
      setSelectedGasType('');
      setNewPrice('');
    },
    onError: (err: any) => toast.error(err.message || 'Error actualizando precio'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGasType || !newPrice) return;
    setPriceMutation.mutate({
      gasTypeId: selectedGasType,
      price: parseFloat(newPrice),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Precios de Combustible</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Administra los precios por litro</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentData?.prices.map((p) => (
          <Card key={p.gasTypeId} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-red-500 to-red-600" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{p.gasTypeName}</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                  Vigente
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                ${formatCurrency(Number(p.price))}
                <span className="text-sm font-normal text-muted-foreground">/litro</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Última actualización por {p.setByName}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-red-600" />
            </div>
            Establecer Nuevo Precio
          </CardTitle>
          <CardDescription>
            Selecciona el tipo de combustible e ingresa el nuevo precio por litro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedGasType} onValueChange={setSelectedGasType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de combustible..." />
                </SelectTrigger>
                <SelectContent>
                  {currentData?.prices.map((p) => (
                    <SelectItem key={p.gasTypeId} value={p.gasTypeId}>
                      <div className="flex items-center justify-between w-full">
                        <span>{p.gasTypeName}</span>
                        <span className="text-muted-foreground ml-4">${formatCurrency(Number(p.price))}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={newPrice}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setNewPrice(v);
                }}
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={setPriceMutation.isPending || !selectedGasType || !newPrice}
              className="h-10 bg-red-600 hover:bg-red-700 text-white"
            >
              {setPriceMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de Precios</CardTitle>
          <CardDescription>Registro de todos los cambios de precio realizados.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium whitespace-nowrap">Tipo</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Precio</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Desde</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Hasta</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData?.prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium whitespace-nowrap">{p.gasTypeName}</TableCell>
                  <TableCell>
                    <span className="font-semibold">${formatCurrency(Number(p.price))}</span>
                  </TableCell>
                  <TableCell>{new Date(p.effectiveFrom).toLocaleDateString('es-ES')}</TableCell>
                  <TableCell>
                    {p.effectiveUntil ? (
                      new Date(p.effectiveUntil).toLocaleDateString('es-ES')
                    ) : (
                      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                        Vigente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.setByName}</TableCell>
                </TableRow>
              ))}
              {(!historyData?.prices || historyData.prices.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Sin historial de precios
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
