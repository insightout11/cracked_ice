import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MobilePlayerCard, MobilePlayerCardEmpty } from './MobilePlayerCard';
import type { RosterPlayer } from '../lib/coachSchemas';
import type { RosterSlot } from '../lib/rosterLayout';

interface LineupSection {
  title: string;
  slots: RosterSlot[];
  icon: string;
}

interface MobileLineupListProps {
  lineup: Record<string, RosterPlayer | null>;
  slots: RosterSlot[];
  onSlotTap: (slotId: string) => void;
  onPlayerTap: (player: RosterPlayer) => void;
  onPlayerMenu: (slotId: string, player: RosterPlayer) => void;
  projections?: Record<string, { games: number; starts?: number; iceScore?: number }>;
}

/**
 * Mobile Lineup List Component
 *
 * Displays roster slots organized by section (Forwards, Defense, Goalies, Bench)
 * Each section is collapsible, and slots are displayed as vertical list items
 */
export function MobileLineupList({
  lineup,
  slots,
  onSlotTap,
  onPlayerTap,
  onPlayerMenu,
  projections
}: MobileLineupListProps) {
  // Group slots by section
  const sections = groupSlotsBySection(slots);

  console.log('[MobileLineupList] Rendering:', {
    slotsCount: slots.length,
    sectionsCount: sections.length,
    lineupKeys: Object.keys(lineup),
    sections: sections.map(s => ({ title: s.title, slotCount: s.slots.length }))
  });

  return (
    <div className="space-y-4 pb-20">
      {sections.map((section) => (
        <MobileLineupSection
          key={section.title}
          section={section}
          lineup={lineup}
          onSlotTap={onSlotTap}
          onPlayerTap={onPlayerTap}
          onPlayerMenu={onPlayerMenu}
          projections={projections}
        />
      ))}
    </div>
  );
}

/**
 * Collapsible Section Component
 */
function MobileLineupSection({
  section,
  lineup,
  onSlotTap,
  onPlayerTap,
  onPlayerMenu,
  projections
}: {
  section: LineupSection;
  lineup: Record<string, RosterPlayer | null>;
  onSlotTap: (slotId: string) => void;
  onPlayerTap: (player: RosterPlayer) => void;
  onPlayerMenu: (slotId: string, player: RosterPlayer) => void;
  projections?: Record<string, { games: number; starts?: number; iceScore?: number }>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{section.icon}</span>
          <div className="text-left">
            <div className="font-bold text-white text-sm uppercase tracking-wide">
              {section.title}
            </div>
            <div className="text-xs text-slate-400">
              {section.slots.length} slot{section.slots.length !== 1 ? 's' : ''}
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
        <div className="px-4 pb-4 space-y-3">
          {section.slots.map((slot) => {
            const player = lineup[slot.id];
            const playerProjections = player ? projections?.[player.id] : undefined;

            return (
              <div key={slot.id} className="space-y-1">
                {/* Slot Label */}
                <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide px-1">
                  {slot.displayName}
                </div>

                {/* Player Card or Empty Slot */}
                {player ? (
                  <MobilePlayerCard
                    player={player}
                    onTap={() => onPlayerTap(player)}
                    onMenu={() => onPlayerMenu(slot.id, player)}
                    iceScore={playerProjections?.iceScore}
                    games={playerProjections?.games}
                    starts={playerProjections?.starts}
                  />
                ) : (
                  <MobilePlayerCardEmpty
                    position={slot.type}
                    onTap={() => onSlotTap(slot.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to group slots by section
 */
function groupSlotsBySection(slots: RosterSlot[]): LineupSection[] {
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
    sections.push({
      title: 'Forwards',
      slots: forwardSlots,
      icon: '🏒'
    });
  }

  if (defenseSlots.length > 0) {
    sections.push({
      title: 'Defense',
      slots: defenseSlots,
      icon: '🛡️'
    });
  }

  if (goalieSlots.length > 0) {
    sections.push({
      title: 'Goalies',
      slots: goalieSlots,
      icon: '🥅'
    });
  }

  if (benchSlots.length > 0) {
    sections.push({
      title: 'Bench',
      slots: benchSlots,
      icon: '💺'
    });
  }

  return sections;
}
