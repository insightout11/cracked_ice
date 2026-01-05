import React from 'react';
import { getFreshnessStatus, formatAge } from '../lib/dataFreshness';

interface DataFreshnessIndicatorProps {
  mtime: string | null | undefined;
  label?: string;
  showAge?: boolean;
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  mtime,
  label,
  showAge = true
}) => {
  const status = getFreshnessStatus(mtime);
  const age = formatAge(mtime);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={status.color}>{status.icon}</span>
      {label && <span className="text-gray-400">{label}:</span>}
      {showAge && <span className="text-gray-300">{age}</span>}
    </span>
  );
};
