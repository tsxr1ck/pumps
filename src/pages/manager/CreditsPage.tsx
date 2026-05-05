import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, patchJson } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Pencil, CreditCard } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { CreditCategory } from '@/types';

export default function CreditsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const { data } = useQuery<{ categories: CreditCategory[] }>({
    queryKey: ['credits'],
    queryFn: () => getJson('/credits'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; code?: string }) => postJson('/credits', body),
    onSuccess: () => {
      toast.success('Categoría creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || 'Error creando categoría'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; code?: string } }) =>
      patchJson(`/credits/${id}`, body),
    onSuccess: () => {
      toast.success('Categoría actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || 'Error actualizando categoría'),
  });

  const resetForm = () => {
    setName('');
    setCode('');
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: { name, code: code || undefined } });
    } else {
      createMutation.mutate({ name, code: code || undefined });
    }
  };

  const startEdit = (cat: CreditCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setCode(cat.code || '');
    setDialogOpen(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorías de Crédito</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Programas corporativos y créditos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.categories.map((cat) => (
          <Card key={cat.id} className={cn('relative overflow-hidden', !cat.isActive && 'opacity-60')}>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-purple-500 to-purple-600" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <Badge variant={cat.isActive ? 'default' : 'secondary'} className={cat.isActive ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                  {cat.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <CardTitle className="text-base mt-3">{cat.name}</CardTitle>
              {cat.code && <CardDescription className="text-xs">Código: {cat.code}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">ID: {cat.id.slice(0, 8)}</p>
                <Button variant="ghost" size="icon" onClick={() => startEdit(cat)}>
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!data?.categories || data.categories.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin categorías registradas</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Crea categorías de crédito para gestionar programas corporativos.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Crear Categoría
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifica los datos de la categoría.' : 'Crea una nueva categoría de crédito.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Ticketcar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código (opcional)</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código identificador"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !name} className="bg-red-600 hover:bg-red-700 text-white">
                {isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
