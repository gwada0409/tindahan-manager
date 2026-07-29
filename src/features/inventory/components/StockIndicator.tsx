import React from 'react';
import { StockStatus } from '@/types';
import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StockIndicatorProps {
  quantity: number;
  reorderLevel?: number;
  status: StockStatus;
  compact?: boolean;
  unit?: string;
  className?: string;
}

export function formatUnit(quantity: number, unit?: string): string {
  if (!unit) return `${quantity} left`;
  const trimmed = unit.trim().toLowerCase();
  
  // Pluralization helpers for common units
  if (quantity === 1) {
    return `1 ${trimmed} left`;
  }

  if (trimmed.endsWith('s') || trimmed.endsWith('x')) {
    return `${quantity} ${trimmed} left`;
  }
  
  if (trimmed === 'box') return `${quantity} boxes left`;
  if (trimmed === 'sachet') return `${quantity} sachets left`;
  if (trimmed === 'pack') return `${quantity} packs left`;
  if (trimmed === 'bottle') return `${quantity} bottles left`;
  if (trimmed === 'piece' || trimmed === 'pc') return `${quantity} pcs left`;
  if (trimmed === 'can') return `${quantity} cans left`;
  if (trimmed === 'bag') return `${quantity} bags left`;
  if (trimmed === 'kg' || trimmed === 'g' || trimmed === 'l' || trimmed === 'ml') {
    return `${quantity} ${trimmed} left`;
  }

  return `${quantity} ${trimmed}s left`;
}

export function StockIndicator({
  quantity,
  reorderLevel = 0,
  status,
  compact = false,
  unit,
  className
}: StockIndicatorProps) {
  
  const getStatusConfig = () => {
    switch (status) {
      case 'out-of-stock':
        return {
          label: 'Out of stock',
          Icon: AlertOctagon,
          badgeStyle: 'bg-destructive/15 text-destructive border-destructive/30',
          iconStyle: 'text-destructive'
        };
      case 'critical':
        return {
          label: 'Critical',
          Icon: AlertTriangle,
          badgeStyle: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
          iconStyle: 'text-red-600 dark:text-red-400'
        };
      case 'low-stock':
        return {
          label: 'Low stock',
          Icon: AlertCircle,
          badgeStyle: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          iconStyle: 'text-amber-600 dark:text-amber-400'
        };
      case 'in-stock':
      default:
        return {
          label: 'In stock',
          Icon: CheckCircle2,
          badgeStyle: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
          iconStyle: 'text-emerald-600 dark:text-emerald-400'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.Icon;
  const quantityText = formatUnit(quantity, unit);
  const accessibleText = `Stock status: ${config.label}. ${quantityText}. Reorder level: ${reorderLevel}.`;

  if (compact) {
    return (
      <span
        tabIndex={0}
        aria-label={accessibleText}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          config.badgeStyle,
          className
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", config.iconStyle)} aria-hidden="true" />
        <span>{config.label} ({quantity})</span>
      </span>
    );
  }

  return (
    <div
      tabIndex={0}
      aria-label={accessibleText}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
        config.badgeStyle,
        className
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", config.iconStyle)} aria-hidden="true" />
      <span className="font-semibold">{config.label}</span>
      <span className="opacity-75">·</span>
      <span>{quantityText}</span>
    </div>
  );
}
