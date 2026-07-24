import { ArrowRightLeft } from 'lucide-react';

export interface SwapIconProps {
  className?: string;
  size?: number;
}

export function SwapIcon({ className, size = 16 }: SwapIconProps) {
  return <ArrowRightLeft className={className} size={size} aria-hidden="true" />;
}
