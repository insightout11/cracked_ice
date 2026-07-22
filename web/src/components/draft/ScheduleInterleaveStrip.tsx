import { useMemo } from 'react';

interface ScheduleInterleaveStripProps {
  anchorTeams: string[];
  anchorsGamesByDate: Record<string, string[]>;
  candidateTeam: string;
  candidateGamesByDate: Record<string, true>;
  slots: number;
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = Date.parse(`${start}T12:00:00Z`); cursor <= Date.parse(`${end}T12:00:00Z`); cursor += DAY_MS) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

export function ScheduleInterleaveStrip({
  anchorTeams,
  anchorsGamesByDate,
  candidateTeam,
  candidateGamesByDate,
  slots,
  start,
  end,
}: ScheduleInterleaveStripProps) {
  const dates = useMemo(() => enumerateDates(start, end), [start, end]);
  const daily = dates.length <= 42;
  const columns = useMemo(() => {
    if (daily) return dates.map((date) => ({ label: date.slice(5), dates: [date] }));
    const weeks: Array<{ label: string; dates: string[] }> = [];
    dates.forEach((date, index) => {
      if (index % 7 === 0) weeks.push({ label: date.slice(5), dates: [] });
      weeks[weeks.length - 1].dates.push(date);
    });
    return weeks;
  }, [daily, dates]);
  const totals = useMemo(() => dates.reduce((counts, date) => {
    if (!candidateGamesByDate[date]) return counts;
    const occupancy = anchorsGamesByDate[date]?.length ?? 0;
    if (occupancy === 0) counts.separate += 1;
    else if (occupancy < slots) counts.shared += 1;
    else counts.blocked += 1;
    return counts;
  }, { separate: 0, shared: 0, blocked: 0 }), [anchorsGamesByDate, candidateGamesByDate, dates, slots]);
  const width = Math.max(640, 118 + columns.length * (daily ? 15 : 24));
  const rowY = { anchor: 44, candidate: 76 };
  const anchorLabel = [...new Set(anchorTeams)].join(', ');
  const ariaLabel = `${candidateTeam} has ${totals.separate} separate game nights, ${totals.shared} shared or full nights, and ${totals.blocked} blocked games alongside ${anchorLabel} between ${start} and ${end}.`;

  return (
    <div className="rounded-lg border border-line bg-surface-0/70 p-3">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-dim">
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />Separate night</span>
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-warning" />Shared / lineup full</span>
        <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ink-mute" />Blocked game</span>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-ink-mute">
        Each column is {daily ? 'one day' : 'one week'}. Cyan games avoid your anchors, yellow games still start but fill the final slot, and gray games are blocked because every slot is already occupied.
      </p>
      <div className="overflow-x-auto">
        <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} 96`} className="h-24 min-w-[640px] w-full">
          <text x="8" y={rowY.anchor + 4} className="fill-ink-dim text-[11px] font-semibold">ANCHORS</text>
          <text x="8" y={rowY.candidate + 4} className="fill-accent text-[11px] font-semibold">{candidateTeam}</text>
          {columns.map((column, index) => {
            const x = 112 + index * (daily ? 15 : 24);
            const occupancy = column.dates.reduce((sum, date) => sum + (anchorsGamesByDate[date]?.length ?? 0), 0);
            const candidateDates = column.dates.filter((date) => candidateGamesByDate[date]);
            const separate = candidateDates.filter((date) => (anchorsGamesByDate[date]?.length ?? 0) === 0).length;
            const shared = candidateDates.filter((date) => {
              const count = anchorsGamesByDate[date]?.length ?? 0;
              return count > 0 && count < slots;
            }).length;
            const blocked = candidateDates.filter((date) => (anchorsGamesByDate[date]?.length ?? 0) >= slots).length;
            const cellWidth = daily ? 7 : 18;
            const center = x + cellWidth / 2;
            return (
              <g key={column.label + index}>
                {(index % (daily ? 7 : 4) === 0) && <text x={x} y="12" className="fill-ink-mute text-[8px]">{column.label}</text>}
                <rect x={x} y={rowY.anchor - 7} width={cellWidth} height="14" rx="4" className="fill-surface-2" />
                {occupancy > 0 && <circle cx={center} cy={rowY.anchor} r={daily ? 3 : Math.min(6, 2 + occupancy)} className="fill-ink-dim" />}
                <rect x={x} y={rowY.candidate - 7} width={cellWidth} height="14" rx="4" className="fill-surface-2" />
                {daily ? (
                  candidateDates.length > 0 && <circle cx={center} cy={rowY.candidate} r="3" className={separate ? 'fill-accent' : shared ? 'fill-warning' : 'fill-ink-mute'} />
                ) : (
                  <>
                    {separate > 0 && <circle cx={center - 5} cy={rowY.candidate} r={Math.min(4, 1.5 + separate / 2)} className="fill-accent" />}
                    {shared > 0 && <circle cx={center} cy={rowY.candidate} r={Math.min(4, 1.5 + shared / 2)} className="fill-warning" />}
                    {blocked > 0 && <circle cx={center + 5} cy={rowY.candidate} r={Math.min(4, 1.5 + blocked / 2)} className="fill-ink-mute" />}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
