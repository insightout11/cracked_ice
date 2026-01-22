import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Calendar, Swords, Shield, Goal, Armchair } from 'lucide-react';
import { MobilePlayerSlot } from '../components/MobilePlayerSlot';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import type { RosterSlot } from '../../lib/rosterLayout';
import type { WorkingLineupPlayer } from '../../components/RosterGrid';
import type { TimeWindowState } from '../../types/timeWindow';

interface MobileLineupViewProps {
  workingLineup: WorkingLineupPlayer[];
  slots: RosterSlot[];
  projections: Record<string, PlayerProjection>;
  timeWindow?: TimeWindowState;
  teamIceScore?: number;
  totalGames?: number;
  totalStarts?: number;
  onPlayerTap: (player: RosterPlayer) => void;
  onPlayerMenu: (slotId: string, player: RosterPlayer) => void;
  onAddPlayer: (slotId: string, position: string) => void;
  onRemovePlayer: (slotId: string, playerId: string) => void;
  onOpenTimeWindow?: () => void;
}

/**
 * Format a date string to compact display format
 */
function formatDateCompact(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface LineupSection {
  id: string;
  title: string;
  icon: ReactNode;
  slots: RosterSlot[];
}

/**
 * Group slots into sections (Forwards, Defense, Goalies, Bench)
 */
function groupSlotsIntoSections(slots: RosterSlot[]): LineupSection[] {
  const forwardSlots = slots.filter((s) =>
    ['LW', 'C', 'RW', 'F', 'UTIL'].includes(s.type)
  );
  const defenseSlots = slots.filter((s) => s.type === 'D');
  const goalieSlots = slots.filter((s) => s.type === 'G');
  const benchSlots = slots.filter((s) =>
    ['BN', 'IR', 'IR+', 'NA'].includes(s.type)
  );

  const sections: LineupSection[] = [];

  if (forwardSlots.length > 0) {
    sections.push({ id: 'forwards', title: 'Forwards', icon: <Swords className="w-6 h-6 text-cyan-400" />, slots: forwardSlots });
  }
  if (defenseSlots.length > 0) {
    sections.push({ id: 'defense', title: 'Defense', icon: <Shield className="w-6 h-6 text-cyan-400" />, slots: defenseSlots });
  }
  if (goalieSlots.length > 0) {
    sections.push({ id: 'goalies', title: 'Goalies', icon: <Goal className="w-6 h-6 text-cyan-400" />, slots: goalieSlots });
  }
  if (benchSlots.length > 0) {
    sections.push({ id: 'bench', title: 'Bench & IR', icon: <Armchair className="w-6 h-6 text-cyan-400" />, slots: benchSlots });
  }

  return sections;
}

/**
 * MobileLineupView - Main roster management tab
 *
 * Features:
 * - Stats summary bar (Team ICE, Games, Starts)
 * - Collapsible sections (Forwards, Defense, Goalies, Bench)
 * - Player cards with ICE scores, stats, trends
 * - Empty slot placeholders
 * - Swipe-to-remove gesture
 */
export function MobileLineupView({
  workingLineup,
  slots,
  projections,
  timeWindow,
  teamIceScore,
  totalGames,
  totalStarts,
  onPlayerTap,
  onPlayerMenu,
  onAddPlayer,
  onRemovePlayer,
  onOpenTimeWindow,
}: MobileLineupViewProps) {
  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['forwards', 'defense', 'goalies', 'bench'])
  );

  // Group slots into sections
  const sections = useMemo(() => groupSlotsIntoSections(slots), [slots]);

  // Create lookup for slot -> player
  const lineupBySlot = useMemo(() => {
    const lookup: Record<string, RosterPlayer | null> = {};
    workingLineup.forEach((item) => {
      lookup[item.slot] = item.player;
    });
    return lookup;
  }, [workingLineup]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Count filled slots in section
  const getSectionStats = useCallback((section: LineupSection) => {
    const filled = section.slots.filter((slot) => lineupBySlot[slot.id]).length;
    return { filled, total: section.slots.length };
  }, [lineupBySlot]);

  // Format time window display
  const timeWindowDisplay = useMemo(() => {
    if (!timeWindow?.config?.startUtc || !timeWindow?.config?.endUtc) {
      return null;
    }
    const start = formatDateCompact(timeWindow.config.startUtc);
    const end = formatDateCompact(timeWindow.config.endUtc);
    return `${start} - ${end}`;
  }, [timeWindow?.config?.startUtc, timeWindow?.config?.endUtc]);

  return (
    <div className="pb-4">
      {/* Stats Summary Bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-700">
        {/* Time Window Row */}
        {onOpenTimeWindow && (
          <button
            onClick={onOpenTimeWindow}
            className="w-full flex items-center justify-center gap-2 py-2 mb-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">
              {timeWindowDisplay || 'Select Date Range'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-xs text-cyan-400 uppercase tracking-wide">Team ICE</div>
            <div className="text-2xl font-bold text-white">
              {teamIceScore?.toFixed(0) || 0}
            </div>
          </div>
          <div className="w-px h-10 bg-slate-700" />
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Games</div>
            <div className="text-2xl font-bold text-white">
              {totalGames || 0}
            </div>
          </div>
          <div className="w-px h-10 bg-slate-700" />
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Starts</div>
            <div className="text-2xl font-bold text-white">
              {totalStarts || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 pt-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const stats = getSectionStats(section);

          return (
            <div
              key={section.id}
              className="mb-4 bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 active:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section.icon}</span>
                  <div className="text-left">
                    <div className="font-bold text-white text-sm uppercase tracking-wide">
                      {section.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {stats.filled}/{stats.total} slots filled
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-cyan-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  {section.slots.map((slot) => {
                    const player = lineupBySlot[slot.id] || null;
                    const projection = player ? projections[player.id] : undefined;

                    return (
                      <MobilePlayerSlot
                        key={slot.id}
                        slotId={slot.id}
                        slotLabel={slot.displayName}
                        player={player}
                        projection={projection}
                        onTap={() => player && onPlayerTap(player)}
                        onMenuTap={() => player && onPlayerMenu(slot.id, player)}
                        onAddPlayer={() => onAddPlayer(slot.id, slot.type)}
                        onSwipeRemove={() => player && onRemovePlayer(slot.id, player.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
