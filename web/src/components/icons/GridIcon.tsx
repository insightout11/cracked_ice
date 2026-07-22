import { Grid3X3 } from 'lucide-react';

export interface GridIconProps {
  className?: string;
  size?: number;
}

export function GridIcon({ className, size = 16 }: GridIconProps) {
  return <Grid3X3 className={className} size={size} aria-hidden="true" />;
}
