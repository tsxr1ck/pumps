import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, patchJson } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/types';

const roleConfig: Record<string, { label: string; color: string; icon: string }> = {
  Manager: { label: 'Encargado', color: 'bg-red-100 text-red-700', icon: 'M' },
  Cashier: { label: 'Cajero', color: 'bg-blue-100 text-blue-700', icon: 'C' },
  Dispatcher: { label: 'Despachador', color: 'bg-green-100 text-green-700', icon: 'D' },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [numericId, setNumericId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'Dispatcher' | 'Cashier' | 'Manager'>('Dispatcher');

  const { data } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => getJson('/users'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { numericId: number; name: string; pin: string; role: string }) =>
      postJson('/users', body),
    onSuccess: () => {
      toast.success('Usuario creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || 'Error creando usuario'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => patchJson(`/users/${id}`, body),
    onSuccess: () => {
      toast.success('Usuario actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || 'Error actualizando usuario'),
  });

  const resetForm = () => {
    setNumericId('');
    setName('');
    setPin('');
    setRole('Dispatcher');
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !numericId) return;

    if (editingId) {
      const body: any = { name };
      if (pin) body.pin = pin;
      updateMutation.mutate({ id: editingId, body });
    } else {
      if (!pin) {
        toast.error('PIN requerido para nuevo usuario');
        return;
      }
      createMutation.mutate({
        numericId: parseInt(numericId),
        name,
        pin,
        role,
      });
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setNumericId(user.numericId.toString());
    setName(user.name);
    setPin('');
    setRole(user.role as any);
    setDialogOpen(true);
  };

  const toggleActive = (user: User) => {
    updateMutation.mutate({ id: user.id, body: { isActive: !user.isActive } });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const users = data?.users || [];
  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} usuarios registrados ({activeUsers.length} activos)
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <UsersIcon className="w-4 h-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactivos</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <UserX className="w-4 h-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-500">{inactiveUsers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium whitespace-nowrap">Usuario</TableHead>
                <TableHead className="font-medium whitespace-nowrap">ID</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Rol</TableHead>
                <TableHead className="font-medium whitespace-nowrap">Estado</TableHead>
                <TableHead className="text-right font-medium whitespace-nowrap">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={cn(!user.isActive && 'opacity-60')}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className={cn('text-xs font-semibold', roleConfig[user.role]?.color || 'bg-slate-100 text-slate-700')}>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono">{user.numericId}</TableCell>
                  <TableCell>
                    <Badge className={cn(roleConfig[user.role]?.color, 'font-medium')}>
                      {roleConfig[user.role]?.label || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(user)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(user)}>
                        {user.isActive ? (
                          <UserX className="w-4 h-4 text-red-500" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="w-8 h-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Sin usuarios registrados</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifica los datos del usuario.' : 'Agrega un nuevo usuario al sistema.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numericId">ID Numérico</Label>
                <Input
                  id="numericId"
                  value={numericId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d+$/.test(v)) setNumericId(v);
                  }}
                  placeholder="1001"
                  disabled={!!editingId}
                  className={cn(editingId && 'bg-muted')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)} disabled={!!editingId}>
                  <SelectTrigger id="role" className={cn(editingId && 'bg-muted')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dispatcher">Despachador</SelectItem>
                    <SelectItem value="Cashier">Cajero</SelectItem>
                    <SelectItem value="Manager">Encargado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN {editingId && '(opcional)'}</Label>
              <Input
                id="pin"
                value={pin}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d{0,6}$/.test(v)) setPin(v);
                }}
                placeholder={editingId ? 'Dejar vacío para no cambiar' : '4-6 dígitos'}
                type="password"
              />
            </div>

            <Separator className="my-4" />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending || !name || !numericId || (!editingId && !pin)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
