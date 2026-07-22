import { useEffect, useState } from 'react';
import { Grid3X3 } from 'lucide-react';
import type { ComplementMatrixResponse } from '../../types';
import { apiService } from '../../services/api';
import { getTeamLogoUrl } from '../../utils/teamLogos';
import { Card } from '../Card';
import { EmptyState } from '../ui/empty-state';

interface ComplementMatrixProps {
  start: string;
  end: string;
  windowLabel: string;
  onSelectPair: (anchorTeam: string, candidateTeam: string) => void;
}

function cellTone(sharedNights: number, min: number, max: number): string {
  const ratio = max === min ? 0 : (sharedNights - min) / (max - min);
  if (ratio <= 0.25) return 'border-positive/40 bg-positive/20 text-positive hover:bg-positive/30';
  if (ratio <= 0.5) return 'border-accent/35 bg-accent/15 text-accent hover:bg-accent/25';
  if (ratio <= 0.75) return 'border-warning/35 bg-warning/15 text-warning hover:bg-warning/25';
  return 'border-negative/35 bg-negative/15 text-negative hover:bg-negative/25';
}

export function ComplementMatrix({ start, end, windowLabel, onSelectPair }: ComplementMatrixProps) {
  const [matrix, setMatrix] = useState<ComplementMatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMatrix(null);
    setError(null);
    apiService.getComplementMatrix({ start, end })
      .then((response) => {
        if (!cancelled) setMatrix(response);
      })
      .catch(() => {
        if (!cancelled) setError('The matrix could not be calculated for this window.');
      });
    return () => { cancelled = true; };
  }, [end, start]);

  if (error) {
    return <EmptyState icon={<Grid3X3 size={22} />} title="Matrix unavailable" description={error} />;
  }

  if (!matrix) {
    return <Card className="p-10 text-center text-ink-dim">Calculating all 496 team pairings…</Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="scoreboard-text mb-2 text-accent">32 × 32 SCHEDULE SURFACE</p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-[0.05em]">Complement Matrix</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-dim">
              Each cell is the number of nights both teams play. Lower overlap leaves more lineup room. Select any pairing to open its verdict and schedule proof.
            </p>
          </div>
          <div className="text-sm text-ink-mute">
            <span className="block">{windowLabel}</span>
            <span className="font-mono text-xs">{start} — {end}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[0.75rem] text-ink-dim" aria-label="Matrix color scale">
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-positive ring-2 ring-positive/20" />Best fit</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-accent/20" />Strong</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-warning/20" />More overlap</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-negative ring-2 ring-negative/20" />Most overlap</span>
          <span className="font-mono text-ink-mute">Range: {matrix.range.minSharedNights}–{matrix.range.maxSharedNights} shared nights</span>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto overscroll-contain p-2 sm:p-4">
        <table className="border-separate border-spacing-1 text-center" aria-label={`Team complement matrix for ${windowLabel}`}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-24 bg-surface-1 px-2 py-2 text-left text-xs text-ink-mute">TEAM</th>
              {matrix.teams.map((team) => (
                <th key={team.code} scope="col" className="sticky top-0 z-20 min-w-11 bg-surface-1 px-1 py-2 font-mono text-[10px] text-ink-dim">
                  {team.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.teams.map((rowTeam) => (
              <tr key={rowTeam.code}>
                <th scope="row" className="sticky left-0 z-10 bg-surface-1 px-2 py-1.5 text-left">
                  <span className="flex items-center gap-2">
                    <img src={getTeamLogoUrl(rowTeam.code)} alt="" className="h-5 w-5 object-contain" />
                    <span className="font-mono text-xs text-ink">{rowTeam.code}</span>
                  </span>
                </th>
                {matrix.teams.map((columnTeam) => {
                  const cell = matrix.cells[rowTeam.code]?.[columnTeam.code];
                  if (!cell) {
                    return <td key={columnTeam.code} className="h-9 min-w-11 rounded-sm bg-surface-2 text-ink-mute">—</td>;
                  }
                  return (
                    <td key={columnTeam.code} className="p-0">
                      <button
                        type="button"
                        onClick={() => onSelectPair(rowTeam.code, columnTeam.code)}
                        aria-label={`${rowTeam.name} and ${columnTeam.name}: ${cell.sharedNights} shared nights, ${cell.usableStarts} usable starts. Open pairing.`}
                        className={`h-9 w-11 rounded-sm border font-mono text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${cellTone(cell.sharedNights, matrix.range.minSharedNights, matrix.range.maxSharedNights)}`}
                      >
                        {cell.sharedNights}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
