import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/lib/api';
import type { Shift } from '@/types';

export function useShift() {
  return useQuery<{ shift: Shift | null }>({
    queryKey: ['active-shift'],
    queryFn: () => getJson('/shifts/active'),
    refetchInterval: 30000,
  });
}
