import React from 'react';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamColor } from '../lib/teamLogos';
import { getPlayerProjection, offNightStarts, startedPoints } from '../lib/playerProjection';
import { SEASON_LABEL } from '../lib/season';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { CARD, CardBackdrop, Headshot, SvgText } from './shareFrameParts';

interface RosterShareFrameProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  fantasyTeam: LeagueWorkspace['fantasyTeam'];
}

interface ShareSlot {
  id: string;
  label: string;
}

interface FormationSection {
  id: 'forwards' | 'flex' | 'defense' | 'goalies';
  label: string;
  columns: number;
  rows: ShareSlot[][];
}

const RESERVE_TYPES = new Set(['BN', 'IR', 'IR+']);
const PAD = 54;
const INNER = 1080 - PAD * 2;
const GAP = 10;

function parseSlot(slot = ''): { type: string; index: number } {
  const match = slot.toUpperCase().match(/^([A-Z+]+)(?:[- ]?(\d+))?$/);
  if (!match) return { type: slot.toUpperCase(), index: 0 };
  return { type: match[1], index: match[2] ? Number(match[2]) : 0 };
}

function canonicalSlot(slot = ''): string {
  const parsed = parseSlot(slot);
  return parsed.type ? `${parsed.type}-${parsed.index}` : '';
}

function reserveSlotLabel(slot = ''): string {
  const parsed = parseSlot(slot);
  if (!parsed.type) return 'ROSTER';
  if (parsed.type === 'BN') return `BN${parsed.index + 1}`;
  return parsed.index > 0 ? `${parsed.type}${parsed.index + 1}` : parsed.type;
}

function makeSlots(type: string, count: number): ShareSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${type}-${index}`,
    label: count === 1 ? type : `${type}${index + 1}`,
  }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function buildFormation(lineupSlots: Record<string, number>): FormationSection[] {
  const sections: FormationSection[] = [];
  const lw = makeSlots('LW', lineupSlots.LW ?? 0);
  const centers = makeSlots('C', lineupSlots.C ?? 0);
  const rw = makeSlots('RW', lineupSlots.RW ?? 0);
  const forwardRows = Array.from(
    { length: Math.max(lw.length, centers.length, rw.length) },
    (_, index) => [lw[index], centers[index], rw[index]].filter((slot): slot is ShareSlot => Boolean(slot)),
  );
  if (forwardRows.length) sections.push({ id: 'forwards', label: 'FORWARD LINES', columns: 3, rows: forwardRows });

  const flexSlots = [...makeSlots('F', lineupSlots.F ?? 0), ...makeSlots('UTIL', lineupSlots.UTIL ?? 0)];
  if (flexSlots.length) sections.push({ id: 'flex', label: 'FLEX', columns: 3, rows: chunk(flexSlots, 3) });

  const defense = makeSlots('D', lineupSlots.D ?? 0);
  if (defense.length) sections.push({ id: 'defense', label: 'DEFENSE PAIRS', columns: 2, rows: chunk(defense, 2) });

  const goalies = makeSlots('G', lineupSlots.G ?? 0);
  if (goalies.length) sections.push({ id: 'goalies', label: 'GOALIES', columns: Math.min(3, goalies.length), rows: chunk(goalies, 3) });
  return sections;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function windowLabel(timeWindow: TimeWindowState): string {
  const start = timeWindow.config?.startUtc;
  const end = timeWindow.config?.endUtc;
  if (!start || !end) return 'Full season';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function scoringLabel(profile: LeagueProfile): string {
  if (profile.preset_name) return profile.preset_name;
  return profile.scoring_type === 'points' ? 'Custom points' : 'League scoring';
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <SvgText text={label} width={Math.round(label.length * 11.5) + 16} size={14} weight={800} color={CARD.accent} letterSpacing={1.5} />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function EmptySlot({ label, width, height }: { label: string; width: number; height: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface-0/50" style={{ width, height }}>
      <SvgText text={label} width={width - 20} size={14} weight={800} color={CARD.mute} anchor="middle" />
      <SvgText text="Open slot" width={width - 20} size={13} weight={500} color={CARD.mute} anchor="middle" />
    </div>
  );
}

/** A player in his lineup slot: photo, name, slot and team, points per game. */
function PlayerTile({ player, projection, slotLabel, width, height }: { player: RosterPlayer; projection?: PlayerProjection; slotLabel: string; width: number; height: number }) {
  const fppg = projection?.fppg ?? player.seasonFppg ?? player.blendedFppg ?? 0;
  const photo = height - 24;
  const textWidth = width - 20 - photo - 12 - 14;
  return (
    <article className="relative flex items-center overflow-hidden rounded-xl border border-line bg-surface-1" style={{ width, height }}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className="ml-5"><Headshot player={player} size={photo} /></div>
      <div className="ml-3 flex flex-col gap-1" style={{ width: textWidth }}>
        <SvgText text={player.full_name} width={textWidth} size={21} weight={800} />
        <SvgText spans={[{ text: `${slotLabel} · ${player.team}   ` }, { text: fppg.toFixed(2), color: CARD.ink, weight: 800 }, { text: ' pts/g' }]} width={textWidth} size={15} weight={600} color={CARD.dim} />
      </div>
    </article>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const width = (INNER - 24) / 3;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-1 px-5 py-4">
      <SvgText text={value} width={width - 40} size={40} weight={800} />
      <SvgText text={label} width={width - 40} size={17} weight={500} color={CARD.dim} />
    </div>
  );
}

/**
 * The whole roster in hockey formation (forward lines, defence pairs, goalies, then the
 * bench), for "what would you change?" posts. Text is SVG so html2canvas draws it
 * where it belongs.
 */
export const RosterShareFrame: React.FC<RosterShareFrameProps> = ({ roster, leagueProfile, projections, timeWindow, fantasyTeam }) => {
  const formation = buildFormation(leagueProfile.lineup_slots);
  const playerBySlot = new Map(roster.map((player) => [canonicalSlot(player.current_slot), player]));
  const configuredSlotIds = new Set(formation.flatMap((section) => section.rows.flatMap((row) => row.map((slot) => slot.id))));
  const reserves = roster.filter((player) => RESERVE_TYPES.has(parseSlot(player.current_slot).type));
  const unplaced = roster.filter((player) => {
    const type = parseSlot(player.current_slot).type;
    return !RESERVE_TYPES.has(type) && !configuredSlotIds.has(canonicalSlot(player.current_slot));
  });
  const projectionValues = roster
    .map((player) => getPlayerProjection(projections, player.id))
    .filter((projection): projection is PlayerProjection => Boolean(projection));
  const starts = projectionValues.reduce((total, projection) => total + projection.starts, 0);
  // Off-nights and points follow the simulated lineup (usable starts), like the My Team scoreboard;
  // bench and IR games would otherwise inflate both.
  const offNights = Math.round(projectionValues.reduce((total, projection) => total + offNightStarts(projection), 0));
  const projectedPoints = projectionValues.reduce((total, projection) => total + startedPoints(projection), 0);
  const hasSchedule = projectionValues.length > 0;
  const fantasyTeamName = fantasyTeam.name.trim() || leagueProfile.league_name;
  const bench = [...reserves, ...unplaced];
  const tileHeight = bench.length > 6 ? 72 : 86;
  const tileWidth = (columns: number) => Math.floor((INNER - GAP * (columns - 1)) / columns);
  const logoSize = fantasyTeam.logoDataUrl ? 84 : 0;

  return (
    <div className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-surface-0 text-ink">
      <CardBackdrop />
      <header className="relative flex items-start justify-between pt-12" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-9 w-auto opacity-90" />
        <div className="flex flex-col items-end gap-1">
          <SvgText text="MY ROSTER" width={260} size={18} weight={800} color={CARD.accent} anchor="end" letterSpacing={2} />
          <SvgText text={`${SEASON_LABEL} · ${windowLabel(timeWindow)}`} width={360} size={18} weight={500} color={CARD.dim} anchor="end" />
        </div>
      </header>

      <section className="relative mt-7" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <div className="flex items-center gap-5">
          {fantasyTeam.logoDataUrl && <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-line-strong bg-surface-1 p-2" style={{ width: logoSize, height: logoSize }}><img src={fantasyTeam.logoDataUrl} alt="" className="size-full object-contain" /></div>}
          <div className="flex flex-col gap-1">
            <SvgText text={fantasyTeamName} width={INNER - logoSize - 20} size={58} weight={900} />
            <SvgText text={[...new Set([fantasyTeamName === leagueProfile.league_name ? '' : leagueProfile.league_name, scoringLabel(leagueProfile)])].filter(Boolean).concat(`${roster.length} players`).join(' · ')} width={INNER - logoSize - 20} size={20} weight={500} color={CARD.dim} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric value={hasSchedule ? projectedPoints.toFixed(0) : '—'} label="projected points" />
          <Metric value={hasSchedule ? String(starts) : '—'} label="lineup starts" />
          <Metric value={hasSchedule ? String(offNights) : '—'} label="off-night starts" />
        </div>
      </section>

      <main className="relative mt-6 flex min-h-0 flex-1 flex-col gap-4" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        {roster.length === 0 ? (
          <div className="grid h-full place-items-center rounded-2xl border border-line bg-surface-1/70">
            <SvgText text="Your roster starts here" width={600} size={34} weight={800} anchor="middle" />
          </div>
        ) : (
          <>
            {formation.map((section) => (
              <section key={section.id}>
                <SectionLabel label={section.label} />
                <div className="flex flex-col" style={{ gap: GAP }}>
                  {section.rows.map((row, rowIndex) => (
                    <div key={`${section.id}-${rowIndex}`} className="flex" style={{ gap: GAP }}>
                      {row.map((slot) => {
                        const player = playerBySlot.get(slot.id);
                        return player
                          ? <PlayerTile key={slot.id} player={player} projection={getPlayerProjection(projections, player.id)} slotLabel={slot.label} width={tileWidth(section.columns)} height={tileHeight} />
                          : <EmptySlot key={slot.id} label={slot.label} width={tileWidth(section.columns)} height={tileHeight} />;
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {bench.length > 0 && (
              <section>
                <SectionLabel label="BENCH & RESERVE" />
                <div className="flex flex-wrap" style={{ gap: GAP }}>
                  {bench.map((player) => <PlayerTile key={player.id} player={player} projection={getPlayerProjection(projections, player.id)} slotLabel={reserveSlotLabel(player.current_slot)} width={tileWidth(3)} height={tileHeight - 8} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="relative mb-10 mt-4 flex items-center justify-between border-t border-line pt-6" style={{ marginLeft: PAD, marginRight: PAD }}>
        <div className="flex flex-col gap-1">
          <SvgText text="WHAT WOULD YOU CHANGE?" width={560} size={24} weight={900} />
          <SvgText text="Who should I add, drop, start or sit?" width={560} size={17} weight={500} color={CARD.dim} />
        </div>
        <SvgText text="crackedicehockey.com" width={300} size={18} weight={500} color={CARD.mute} anchor="end" />
      </footer>
    </div>
  );
};
