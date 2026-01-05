// @ts-nocheck
import React from 'react';
import { Calendar, Rocket, Moon } from 'lucide-react';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import type { TeamTierData } from '../types/teamTiers';
import type { ShareFormat } from './ShareRosterModal';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import { getIceCircleStyle } from '../lib/iceScore';

interface RosterShareFrameProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  getTeamTier?: (teamCode: string) => TeamTierData | undefined;
  format?: ShareFormat;
  width?: number;
  height?: number;
}

interface SharePlayerCardProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  slotLabel: string;
}

// Helper to parse slot for sorting
const parseSlot = (slot: string): { type: string; index: number } => {
  const match = slot.match(/^([A-Z]+)-(\d+)$/);
  if (!match) return { type: slot, index: 0 };
  return { type: match[1], index: parseInt(match[2], 10) };
};

// Sort players by slot
const sortBySlot = (players: RosterPlayer[]): RosterPlayer[] => {
  return [...players].sort((a, b) => {
    const slotA = parseSlot(a.current_slot || '');
    const slotB = parseSlot(b.current_slot || '');

    // First by slot type
    if (slotA.type !== slotB.type) {
      return slotA.type.localeCompare(slotB.type);
    }

    // Then by index
    return slotA.index - slotB.index;
  });
};

// Format slot label for display
const formatSlotLabel = (slot: string): string => {
  if (!slot) return '';

  // Handle special formats
  if (slot.includes('-')) {
    const [type, num] = slot.split('-');
    const index = parseInt(num, 10);

    // Format based on type
    if (type === 'BN') return `BN${index + 1}`;
    if (type === 'IR') return `IR${index + 1}`;
    if (type === 'D') return `D${index + 1}`;
    if (type === 'G') return `G${index + 1}`;

    // Forwards - keep as is (LW, C, RW)
    return `${type}${index + 1}`;
  }

  return slot;
};

const SharePlayerCard: React.FC<SharePlayerCardProps> = ({ player, projection, slotLabel }) => {
  const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';
  const teamColor = getTeamColor(player.team);
  const teamLogo = getTeamLogoUrl(player.team);

  // Generate NHL headshot URL
  const getHeadshotUrl = (playerId: string, team: string) => {
    const numericId = playerId.replace(/^nhl:/, '');
    return `https://assets.nhle.com/mugs/nhl/20242025/${team}/${numericId}.png`;
  };
  const headshotUrl = getHeadshotUrl(player.id, player.team);

  // Calculate ICE Score
  const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
  const last30Fppg = (player as any).last30Fppg ?? seasonFppg;
  const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
  const iceScore = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);

  // Get ICE circle style
  const iceCircleStyle = getIceCircleStyle(iceScore, 0, 4);

  // Format SoS color
  const getSosColor = (sos?: number) => {
    if (sos === undefined) return 'bg-gray-400';
    if (sos >= 7) return 'bg-emerald-400';
    if (sos <= 3) return 'bg-rose-500';
    return 'bg-amber-400';
  };

  return (
    <div className="relative rounded-xl bg-slate-900/75 px-4 py-3 shadow-[0_0_0_1px_rgba(15,23,42,0.7)] h-[90px] flex flex-col justify-between">
      {/* Team color accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
        style={{ backgroundColor: teamColor }}
      />

      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Slot label pill */}
          <span className="inline-flex items-center rounded-full border border-sky-500/60 bg-sky-900/70 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-sky-100 flex-shrink-0">
            {slotLabel}
          </span>

          {/* Player headshot */}
          <div className="flex-shrink-0">
            <img
              src={headshotUrl}
              alt={player.full_name}
              className="w-7 h-7 rounded-full bg-slate-800/80 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Team logo */}
          <div className="flex-shrink-0">
            <img
              src={teamLogo}
              alt={player.team}
              className="w-7 h-7 rounded-full bg-slate-800/80 p-0.5 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Player info */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-50 truncate max-w-[220px]">
              {player.full_name}
            </span>
            <span className="text-[11px] text-slate-400">
              {player.team} • {positions}
            </span>
          </div>
        </div>

        {/* ICE score badge */}
        <div className="flex-shrink-0 ml-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              background: iceCircleStyle.backgroundColor,
              border: iceCircleStyle.border,
              boxShadow: iceCircleStyle.boxShadow,
              color: iceCircleStyle.textColor,
            }}
          >
            {iceScore.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {projection && (
        <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-300">
          <span className="flex items-center gap-1" title="Games Available">
            <Calendar className="w-3 h-3 text-slate-400" />
            {projection.gamesAvailable}
          </span>
          <span className="flex items-center gap-1" title="Starts">
            <Rocket className="w-3 h-3 text-cyan-400" />
            {projection.starts}
          </span>
          <span className="flex items-center gap-1" title="Off-Night Games">
            <Moon className="w-3 h-3 text-purple-400" />
            {Math.round((projection.offNightRate ?? 0) * projection.gamesAvailable)}
          </span>
          {projection.strengthOfSchedule !== undefined && (
            <span className="flex items-center gap-1" title="Strength of Schedule">
              <div className={`w-2 h-2 rounded-full ${getSosColor(projection.strengthOfSchedule)}`} />
              <span className="font-medium">SoS {projection.strengthOfSchedule}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const RosterShareFrame: React.FC<RosterShareFrameProps> = ({
  roster,
  leagueProfile,
  projections,
  timeWindow,
  getTeamTier,
  format = 'landscape-standard',
  width = 1920,
  height = 1080,
}) => {
  const isPortrait = format.startsWith('portrait');
  // Format date range for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const startDate = timeWindow.config?.startUtc;
  const endDate = timeWindow.config?.endUtc;
  const dateRange = startDate && endDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : 'Season View';

  const modeLabel = timeWindow.mode === 'playoff'
    ? 'Playoff'
    : timeWindow.mode === 'custom'
    ? 'Custom'
    : 'Full Season';

  // Group players by slot type
  const forwards = roster.filter(p => {
    const slot = p.current_slot || '';
    const positions = Array.isArray(p.positions) ? p.positions : [];
    return (slot.startsWith('LW-') || slot.startsWith('C-') || slot.startsWith('RW-') || slot.startsWith('F-')) ||
           (!slot.startsWith('BN-') && !slot.startsWith('IR-') && !slot.startsWith('D-') && !slot.startsWith('G-') &&
            positions.some(pos => ['C', 'LW', 'L', 'RW', 'R', 'F'].includes(pos)));
  });

  const defense = roster.filter(p => {
    const slot = p.current_slot || '';
    const positions = Array.isArray(p.positions) ? p.positions : [];
    return slot.startsWith('D-') ||
           (!slot.startsWith('BN-') && !slot.startsWith('IR-') && !slot.startsWith('LW-') && !slot.startsWith('C-') && !slot.startsWith('RW-') && !slot.startsWith('F-') && !slot.startsWith('G-') &&
            positions.includes('D') && !positions.some(pos => ['C', 'LW', 'L', 'RW', 'R', 'F', 'G'].includes(pos)));
  });

  const goalies = roster.filter(p => {
    const slot = p.current_slot || '';
    const positions = Array.isArray(p.positions) ? p.positions : [];
    return slot.startsWith('G-') ||
           (!slot.startsWith('BN-') && !slot.startsWith('IR-') && positions.includes('G'));
  });

  const bench = roster.filter(p => {
    const slot = p.current_slot || '';
    return slot.startsWith('BN-');
  });

  const ir = roster.filter(p => {
    const slot = p.current_slot || '';
    return slot.startsWith('IR-');
  });

  // Sort each group by slot
  const sortedForwards = sortBySlot(forwards);
  const sortedDefense = sortBySlot(defense);
  const sortedGoalies = sortBySlot(goalies);
  const sortedBench = sortBySlot(bench);
  const sortedIR = sortBySlot(ir);

  // Group forwards into lines (LW-C-RW)
  const forwardLines: RosterPlayer[][] = [];
  const lwPlayers = sortedForwards.filter(p => p.current_slot?.startsWith('LW-'));
  const cPlayers = sortedForwards.filter(p => p.current_slot?.startsWith('C-'));
  const rwPlayers = sortedForwards.filter(p => p.current_slot?.startsWith('RW-'));
  const maxLines = Math.max(lwPlayers.length, cPlayers.length, rwPlayers.length);

  for (let i = 0; i < maxLines; i++) {
    const line = [];
    if (lwPlayers[i]) line.push(lwPlayers[i]);
    if (cPlayers[i]) line.push(cPlayers[i]);
    if (rwPlayers[i]) line.push(rwPlayers[i]);
    if (line.length > 0) forwardLines.push(line);
  }

  // Group defense into pairings (D-D)
  const defensePairings: RosterPlayer[][] = [];
  for (let i = 0; i < sortedDefense.length; i += 2) {
    const pairing = [sortedDefense[i]];
    if (sortedDefense[i + 1]) pairing.push(sortedDefense[i + 1]);
    defensePairings.push(pairing);
  }

  return (
    <div
      id="roster-share-frame"
      className="rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundImage: 'url(/hockey-rink-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Top header */}
      <header className="relative flex items-center justify-between px-6 py-2 border-b border-slate-700/30 bg-slate-900/90 backdrop-blur-md">
        {/* Cracked Ice Wordmark - Top Left */}
        <img
          src="/upscalemedia-transformed (1).png"
          alt="Cracked Ice"
          className="h-10 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <div className="text-right">
          <div className="text-sm font-semibold text-slate-200">{dateRange}</div>
          <div className="text-xs text-slate-400">{modeLabel} • Compact View</div>
        </div>
      </header>

      {/* Roster body - Dynamic layout based on format */}
      <main className="relative flex-1 px-8 py-4 overflow-hidden">
        <div className={isPortrait ? "flex flex-col gap-4 h-full" : "grid grid-cols-[3fr,2fr] gap-6 h-full"}>
          {/* LEFT COLUMN: Main roster */}
          <div className="flex flex-col gap-4 overflow-auto">
            {/* Forwards - displayed as lines (LW-C-RW) */}
            {forwardLines.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">
                  FORWARDS
                </h3>
                <div className="space-y-2">
                  {forwardLines.map((line, lineIdx) => (
                    <div key={`line-${lineIdx}`} className="grid grid-cols-12 gap-2">
                      {line.map((player) => (
                        <div key={player.id} className="col-span-4">
                          <SharePlayerCard
                            player={player}
                            projection={projections[player.id]}
                            slotLabel={formatSlotLabel(player.current_slot || '')}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Defense - 2 per row, centered */}
            {defensePairings.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">
                  DEFENSE
                </h3>
                <div className="space-y-2">
                  {defensePairings.map((pairing, pairingIdx) => (
                    <div key={`pairing-${pairingIdx}`} className="grid grid-cols-12 gap-2">
                      <div className="col-span-2"></div>
                      {pairing.map((player) => (
                        <div key={player.id} className="col-span-4">
                          <SharePlayerCard
                            player={player}
                            projection={projections[player.id]}
                            slotLabel={formatSlotLabel(player.current_slot || '')}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Goalies - 1 per row, centered */}
            {sortedGoalies.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">
                  GOALIES
                </h3>
                <div className="space-y-2">
                  {sortedGoalies.map((player) => (
                    <div key={player.id} className="grid grid-cols-12 gap-2">
                      <div className="col-span-4"></div>
                      <div className="col-span-4">
                        <SharePlayerCard
                          player={player}
                          projection={projections[player.id]}
                          slotLabel={formatSlotLabel(player.current_slot || '')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Bench + IR */}
          <div className="flex flex-col gap-4 overflow-auto">
            {/* Bench */}
            {sortedBench.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">
                  BENCH
                </h3>
                <div className="grid grid-cols-12 gap-2">
                  {sortedBench.map((player) => (
                    <div key={player.id} className="col-span-4">
                      <SharePlayerCard
                        player={player}
                        projection={projections[player.id]}
                        slotLabel={formatSlotLabel(player.current_slot || '')}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* IR */}
            {sortedIR.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-2">
                  INJURED RESERVE
                </h3>
                <div className="grid grid-cols-12 gap-2">
                  {sortedIR.map((player) => (
                    <div key={player.id} className="col-span-4">
                      <SharePlayerCard
                        player={player}
                        projection={projections[player.id]}
                        slotLabel={formatSlotLabel(player.current_slot || '')}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative px-8 py-2 text-[11px] text-slate-400 flex justify-between items-center border-t border-white/5">
        <span>Off-night optimized • SoS-aware • ICE Score powered</span>
        <span className="text-slate-500">Generated with Cracked Ice</span>
      </footer>
    </div>
  );
};
