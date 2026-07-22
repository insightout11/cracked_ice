import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ChevronIconProps {
  className?: string;
  direction?: 'up' | 'down';
  size?: number;
}

export function ChevronIcon({ className, direction = 'down', size = 12 }: ChevronIconProps) {
  return <ChevronDown className={cn(direction === 'up' && 'rotate-180', className)} size={size} aria-hidden="true" />;
}
