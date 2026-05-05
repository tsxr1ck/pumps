import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  DollarSign,
  CreditCard,
  Users,
  Clock,
  Fuel,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson } from '@/lib/api';

const navItems = [
  { to: '/manage', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/manage/prices', label: 'Precios', icon: DollarSign },
  { to: '/manage/credits', label: 'Créditos', icon: CreditCard },
  { to: '/manage/users', label: 'Usuarios', icon: Users },
  { to: '/manage/shifts', label: 'Turnos', icon: Clock },
  { to: '/manage/withdrawals/pending', label: 'Retiros', icon: Receipt },
];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ManagerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { subscribe } = useSocket();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: pendingData } = useQuery<{ withdrawals: any[] }>({
    queryKey: ['withdrawals-pending'],
    queryFn: () => getJson('/withdrawals/pending'),
    refetchInterval: 15000,
  });
  const pendingCount = pendingData?.withdrawals?.length || 0;
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub1 = subscribe('shift:opened', () => toast.success('Nuevo turno abierto'));
    const unsub2 = subscribe('withdrawal:created', (data: any) => {
      if (data?.withdrawal?.status === 'pending') {
        queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
        toast.warning(
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Nuevo Retiro Pendiente</p>
            <p className="text-sm">${Number(data.withdrawal.amount || 0).toFixed(2)}</p>
          </div>,
          { duration: 8000 }
        );
      }
    });
    const unsub3 = subscribe('withdrawal:updated', (data: any) => {
      if (data?.withdrawal?.status !== 'pending') {
        queryClient.invalidateQueries({ queryKey: ['withdrawals-pending'] });
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe, queryClient]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const sidebar = (
    <aside
      className={cn(
        'relative flex flex-col bg-white border-r border-slate-200/60 shadow-sm transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className={cn('flex items-center border-b border-slate-100 bg-white', collapsed ? 'justify-center px-3 py-5' : 'px-5 py-5')}>
        <div className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <Fuel className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">Volumetrico</h1>
              <p className="text-xs text-muted-foreground">Panel de Gestión</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 py-4 px-3 overflow-y-auto">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  collapsed && 'justify-center px-2',
                  isActive ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <item.icon className={cn('w-5 h-5 shrink-0', collapsed && 'w-4 h-4')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={cn('p-4 border-t border-slate-100', collapsed && 'px-2 py-3 flex flex-col items-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none flex items-center gap-2 group w-full">
            <Avatar className={cn('cursor-pointer ring-2 ring-white shadow-sm transition-transform group-hover:scale-105', collapsed ? 'w-8 h-8' : 'w-9 h-9')}>
              <AvatarFallback className="bg-red-100 text-red-700 text-xs font-semibold">
                {user?.name ? getInitials(user.name) : '??'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden text-left">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-50 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors hidden lg:flex"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
      </button>
    </aside>
  );

  const mobileNav = (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-0',
                isActive ? 'text-red-600' : 'text-slate-500 hover:text-slate-700'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="truncate max-w-[60px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );

  const mobileDrawer = (
    <>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Volumetrico</h1>
              <p className="text-xs text-muted-foreground">Panel de Gestión</p>
            </div>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="py-4 px-3">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-red-100 text-red-700 text-sm font-semibold">
                {user?.name ? getInitials(user.name) : '??'}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen from-slate-50 to-slate-100 flex pb-16 lg:pb-0">
      <div className="hidden lg:flex">{sidebar}</div>
      {mobileDrawer}

      <main className="flex-1 min-h-screen min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Fuel className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">Volumetrico</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {pendingCount > 0 && (
                <button
                  onClick={() => navigate('/manage/withdrawals/pending')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-sm font-semibold"
                >
                  <Bell className="w-4 h-4" />
                  <span>{pendingCount}</span>
                </button>
              )}
              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 font-medium hidden sm:inline-flex">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                En línea
              </Badge>
            </div>
          </div>
        </header>
        <div className="px-3 sm:px-6 lg:px-8 py-4 lg:py-6">
          <Outlet />
        </div>
      </main>
      {mobileNav}
    </div>
  );
}
