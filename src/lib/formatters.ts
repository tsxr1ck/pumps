/**
 * Shared formatting utilities with cached Intl instances.
 * Single source of truth — imported across all components.
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const litersFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatLiters(value: number): string {
  return litersFormatter.format(value);
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('es-ES');
}

export function formatShortDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('es-ES');
}
