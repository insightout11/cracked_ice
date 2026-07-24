import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Swords, Shield, Goal, Armchair } from 'lucide-react';
import { MobilePlayerSlot } from '../components/MobilePlayerSlot';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { canDrop, type RosterSlot, type SlotType } from '../../lib/rosterLayout';
import type { WorkingLineupPlayer } from '../../components/RosterGrid';
import type { TimeWindowState } from '../../types/timeWindow';
import { getPlayerProjection } from '../../lib/playerProjection';

interface MobileLineupViewProps {
  workingLineup: WorkingLineupPlayer[];
  slots: RosterSlot[];
  projections: Record<string, PlayerProjection>;
  timeWindow?: TimeWindowState;
  teamIceScore?: number;
  totalGames?: number;
  totalStarts?: number;
  onPlayerTap: (player: RosterPlayer) => void;
  onAddPlayer: (slotId: string, position: string) => void;
  onRemovePlayer: (slotId: string, playerId: string) => void;
  onOpenTimeWindow?: () => void;
  onWeekChange?: (direction: 'prev' | 'next') => void;
  // Drag state
  isDragging?: boolean;
  activePlayerId?: string | null;
  overSlotId?: string | null;
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
    sections.push({ id: 'forwards', title: 'Forwards', icon: <Swords className="w-4 h-4 text-accent" />, slots: forwardSlots });
  }
  if (defenseSlots.length > 0) {
    sections.push({ id: 'defense', title: 'Defense', icon: <Shield className="w-4 h-4 text-accent" />, slots: defenseSlots });
  }
  if (goalieSlots.length > 0) {
    sections.push({ id: 'goalies', title: 'Goalies', icon: <Goal className="w-4 h-4 text-accent" />, slots: goalieSlots });
  }
  if (benchSlots.length > 0) {
    sections.push({ id: 'bench', title: 'Bench & IR', icon: <Armchair className="w-4 h-4 text-accent" />, slots: benchSlots });
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
  onAddPlayer,
  onRemovePlayer,
  onOpenTimeWindow,
  onWeekChange,
  isDragging = false,
  activePlayerId,
  overSlotId,
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

  // Get active player for drag eligibility calculations
  const activePlayer = useMemo(() => {
    if (!activePlayerId) return null;
    for (const item of workingLineup) {
      if (item.player?.id === activePlayerId) {
        return item.player;
      }
    }
    return null;
  }, [activePlayerId, workingLineup]);

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
    <div className="pb-2">
      {/* Stats Summary Bar - Compact */}
      <div className="sticky top-0 z-10 bg-surface-2 backdrop-blur-md px-3 py-2 border-b border-line">
        {/* Time Window Row with Week Navigation */}
        {(onOpenTimeWindow || onWeekChange) && (
          <div className="flex items-center justify-center gap-1 mb-2">
            {onWeekChange && (
              <button
                onClick={() => onWeekChange('prev')}
                className="p-1.5 rounded bg-surface-2 border border-line hover:border-accent active:bg-surface-2 transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4 text-accent" />
              </button>
            )}

            {onOpenTimeWindow && (
              <button
                onClick={onOpenTimeWindow}
                className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-surface-2 rounded-lg hover:bg-surface-2 active:bg-surface-2 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-medium text-ink">
                  {timeWindowDisplay || 'Select Date Range'}
                </span>
              </button>
            )}

            {onWeekChange && (
              <button
                onClick={() => onWeekChange('next')}
                className="p-1.5 rounded bg-surface-2 border border-line hover:border-accent active:bg-surface-2 transition-colors"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4 text-accent" />
              </button>
            )}
          </div>
        )}

        {/* Stats Row - Compact */}
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-[10px] text-accent uppercase tracking-wide">Team ICE</div>
            <div className="text-lg font-bold text-ink">
              {teamIceScore?.toFixed(0) || 0}
            </div>
          </div>
          <div className="w-px h-8 bg-surface-2" />
          <div className="text-center">
            <div className="text-[10px] text-ink-dim uppercase tracking-wide">Games</div>
            <div className="text-lg font-bold text-ink">
              {totalGames || 0}
            </div>
          </div>
          <div className="w-px h-8 bg-surface-2" />
          <div className="text-center">
            <div className="text-[10px] text-ink-dim uppercase tracking-wide">Starts</div>
            <div className="text-lg font-bold text-ink">
              {totalStarts || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Sections - Compact */}
      <div className="px-2 pt-2">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const stats = getSectionStats(section);

          return (
            <div
              key={section.id}
              className="mb-2 bg-surface-2 rounded-lg border border-line overflow-hidden"
            >
              {/* Section Header - Compact */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-2 active:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {section.icon}
                  <span className="font-bold text-ink text-xs uppercase tracking-wide">
                    {section.title}
                  </span>
                  <span className="text-[10px] text-ink-dim">
                    ({stats.filled}/{stats.total})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-accent" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-dim" />
                )}
              </button>

              {/* Section Content - Compact */}
              {isExpanded && (
                <div className="px-2 pb-2">
                  {section.slots.map((slot) => {
                    const player = lineupBySlot[slot.id] || null;
                    const projection = player ? getPlayerProjection(projections, player.id) : undefined;

                    // Calculate if this slot is a valid drop target for the active player
                    const isValidTarget = activePlayer
                      ? canDrop(activePlayer, slot.type as SlotType)
                      : false;

                    // Check if this player is being dragged
                    const isBeingDragged = player?.id === activePlayerId;

                    // Check if this slot is currently hovered
                    const isOver = slot.id === overSlotId;

                    return (
                      <MobilePlayerSlot
                        key={slot.id}
                        slotId={slot.id}
                        slotLabel={slot.displayName}
                        player={player}
                        projection={projection}
                        onTap={() => player && onPlayerTap(player)}
                        onAddPlayer={() => onAddPlayer(slot.id, slot.type)}
                        onSwipeRemove={() => player && onRemovePlayer(slot.id, player.id)}
                        isDragging={isDragging}
                        isBeingDragged={isBeingDragged}
                        isOver={isOver}
                        isValidTarget={isValidTarget}
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
