import { useState, useEffect } from 'react';
import type { LeagueProfile } from '../lib/coachSchemas';
import { LeagueWeeksWizard } from './TimeWindow/LeagueWeeksWizard';
import type { LeagueWeekConfig } from '../types/playoffMode';

interface LeagueSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  league: LeagueProfile | null;
  onSave: (league: LeagueProfile) => void;
}

// Common presets
const PRESETS = {
  'KKUPFL': {
    num_teams: 14,
    playoff_start_date: '2025-03-16',
    playoff_end_date: '2025-04-05',
    scoring_type: 'points' as const,
    lineup_slots: {
      C: 2,
      LW: 2,
      RW: 2,
      UTIL: 2,
      D: 4,
      G: 2,
      BN: 4,
    },
    skater_scoring: {
      goals: 4.5,
      assists: 3,
      shots_on_goal: 0.5,
      shorthanded_goals: 2,
      shorthanded_assists: 2,
      blocks: 0.5,
      hits: 0.25,
    },
    goalie_scoring: {
      wins: 3,
      saves: 0.30,
      goals_against: -1.5,
      shutouts: 3,
    },
  },
  'APL': {
    num_teams: 12,
    playoff_start_date: '2025-03-16',
    playoff_end_date: '2025-04-05',
    scoring_type: 'points' as const,
    lineup_slots: {
      C: 3,
      LW: 3,
      RW: 3,
      D: 4,
      UTIL: 1,
      G: 2,
      BN: 4,
      'IR+': 5,
    },
    skater_scoring: {
      goals: 5,
      assists: 3.75,
      shots_on_goal: 0.5,
      powerplay_points: 0.5,
      hits: 0.3,
      blocks: 0.6,
    },
    goalie_scoring: {
      wins: 2.75,
      saves: 0.35,
      goals_against: -1.5,
      shutouts: 3,
    },
  },
  'Yahoo Standard': {
    num_teams: 12,
    scoring_type: 'points' as const,
    lineup_slots: {
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      BN: 4,
      IR: 2,
      'IR+': 0,
    },
    skater_scoring: {
      goals: 6,
      assists: 4,
      power_play_points: 2,
      shorthanded_goals: 4,
      shots_on_goal: 0.9,
      blocks: 1,
      hits: 0.5,
      plus_minus: 2,
    },
    goalie_scoring: {
      wins: 5,
      saves: 0.6,
      goals_against: -3,
      shutouts: 3,
    },
  },
  'ESPN Standard': {
    num_teams: 12,
    scoring_type: 'points' as const,
    lineup_slots: {
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      BN: 4,
      IR: 1,
      'IR+': 1,
    },
    skater_scoring: {
      goals: 3,
      assists: 2,
      power_play_points: 1,
      shorthanded_goals: 2,
      shots_on_goal: 0.4,
      blocks: 0.4,
      hits: 0.2,
      plus_minus: 0.25,
    },
    goalie_scoring: {
      wins: 5,
      saves: 0.6,
      goals_against: -3,
      shutouts: 5,
    },
  },
  'Chesterfield League': {
    num_teams: 10,
    playoff_start_date: '2025-03-16',
    playoff_end_date: '2025-04-05',
    scoring_type: 'points' as const,
    lineup_slots: {
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      BN: 4,
      IR: 1,
      'IR+': 1,
    },
    skater_scoring: {
      goals: 1.3,
      assists: 1.3,
      powerplay_points: 1,
      shorthanded_goals: 3,
      shorthanded_assists: 2,
      game_winning_goals: 1,
      shots_on_goal: 0.1,
      hits: 0.1,
      blocks: 0.1,
    },
    goalie_scoring: {
      wins: 2,
      saves: 0.1,
      goals_against: -0.5,
      shutouts: 2,
    },
  },
};

const COMMON_SKATER_STATS = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'points', label: 'Points' },
  { key: 'power_play_points', label: 'Power Play Points' },
  { key: 'powerplay_goals', label: 'PP Goals' },
  { key: 'powerplay_assists', label: 'PP Assists' },
  { key: 'shorthanded_goals', label: 'Shorthanded Goals' },
  { key: 'shorthanded_assists', label: 'SH Assists' },
  { key: 'game_winning_goals', label: 'Game Winning Goals' },
  { key: 'shots_on_goal', label: 'Shots on Goal' },
  { key: 'hits', label: 'Hits' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'plus_minus', label: 'Plus/Minus' },
  { key: 'penalty_minutes', label: 'Penalty Minutes' },
  { key: 'faceoffs_won', label: 'Faceoffs Won' },
];

const COMMON_GOALIE_STATS = [
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'overtime_losses', label: 'OT Losses' },
  { key: 'saves', label: 'Saves' },
  { key: 'goals_against', label: 'Goals Against' },
  { key: 'goals_against_average', label: 'GAA' },
  { key: 'save_percentage', label: 'Save %' },
  { key: 'shutouts', label: 'Shutouts' },
  { key: 'games_started', label: 'Games Started' },
];

const POSITION_SLOTS = [
  { key: 'C', label: 'Center (C)' },
  { key: 'LW', label: 'Left Wing (LW)' },
  { key: 'RW', label: 'Right Wing (RW)' },
  { key: 'D', label: 'Defense (D)' },
  { key: 'G', label: 'Goalie (G)' },
  { key: 'UTIL', label: 'Utility (UTIL)' },
  { key: 'BN', label: 'Bench (BN)' },
  { key: 'IR', label: 'Injured Reserve (IR)' },
  { key: 'IR+', label: 'IR+ (IR+)' },
];

export function LeagueSettingsDrawer({ isOpen, onClose, league, onSave }: LeagueSettingsDrawerProps) {
  const [editedLeague, setEditedLeague] = useState<LeagueProfile | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [expandedSection, setExpandedSection] = useState<string>('league-info');
  const [isLeagueWeeksOpen, setIsLeagueWeeksOpen] = useState(false);

  // Initialize with league prop
  useEffect(() => {
    if (isOpen && league) {
      setEditedLeague({ ...league });
      setSelectedPreset(league.preset_name || '');
    }
  }, [isOpen, league]);

  if (!isOpen || !editedLeague) return null;

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset && PRESETS[preset as keyof typeof PRESETS]) {
      const presetData = PRESETS[preset as keyof typeof PRESETS];
      setEditedLeague({
        ...editedLeague,
        preset_name: preset,
        num_teams: presetData.num_teams,
        scoring_type: presetData.scoring_type,
        lineup_slots: { ...presetData.lineup_slots },
        skater_scoring: { ...presetData.skater_scoring },
        goalie_scoring: { ...presetData.goalie_scoring },
        playoff_start_date: (presetData as any).playoff_start_date,
        playoff_end_date: (presetData as any).playoff_end_date,
      });
    }
  };

  const handleSave = () => {
    if (editedLeague) {
      onSave(editedLeague);
      onClose();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  const updateLeagueField = (field: keyof LeagueProfile, value: any) => {
    setEditedLeague({ ...editedLeague, [field]: value });
  };

  const updateSlotCount = (slot: string, count: number) => {
    setEditedLeague({
      ...editedLeague,
      lineup_slots: {
        ...editedLeague.lineup_slots,
        [slot]: Math.max(0, count),
      },
    });
  };

  const updateSkaterStat = (stat: string, value: number) => {
    setEditedLeague({
      ...editedLeague,
      skater_scoring: {
        ...(editedLeague.skater_scoring || {}),
        [stat]: value,
      },
    });
    setSelectedPreset(''); // Auto-switch to Custom
  };

  const updateGoalieStat = (stat: string, value: number) => {
    setEditedLeague({
      ...editedLeague,
      goalie_scoring: {
        ...(editedLeague.goalie_scoring || {}),
        [stat]: value,
      },
    });
    setSelectedPreset(''); // Auto-switch to Custom
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[999]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-[500px] max-w-[90vw] bg-slate-900 shadow-2xl z-[1000] flex flex-col text-white">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-semibold">League Settings</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preset Selector */}
        <div className="px-5 py-3 bg-white/5 border-b border-white/10">
          <label className="block text-xs font-semibold text-cyan-300 mb-2 uppercase tracking-wider">
            Preset
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Custom</option>
            {Object.keys(PRESETS).map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Section 1: League Info */}
          <div className="border-b border-white/10">
            <button
              onClick={() => toggleSection('league-info')}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-semibold text-sm">League Info</span>
              <span className="text-xl">{expandedSection === 'league-info' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'league-info' && (
              <div className="px-5 py-4 space-y-4 bg-white/5">
                {/* League Name */}
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    League Name
                  </label>
                  <input
                    type="text"
                    value={editedLeague.league_name}
                    onChange={(e) => updateLeagueField('league_name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Number of Teams */}
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    Number of Teams
                  </label>
                  <input
                    type="number"
                    value={editedLeague.num_teams || 12}
                    onChange={(e) => updateLeagueField('num_teams', parseInt(e.target.value))}
                    min="4"
                    max="32"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Scoring Type */}
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    Scoring Type
                  </label>
                  <select
                    value={editedLeague.scoring_type}
                    onChange={(e) => updateLeagueField('scoring_type', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="points">Points</option>
                    <option value="categories">Categories</option>
                  </select>
                </div>

                {/* Playoff Weeks */}
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    Playoff Weeks
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLeagueWeeksOpen(true)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm hover:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-left"
                  >
                    {editedLeague.playoff_start_date && editedLeague.playoff_end_date ? (
                      <span className="text-white">
                        {new Date(editedLeague.playoff_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(editedLeague.playoff_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : editedLeague.playoff_start_date ? (
                      <span className="text-white">
                        Starts: {new Date(editedLeague.playoff_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-white/70">Configure weeks...</span>
                    )}
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editedLeague.notes || ''}
                    onChange={(e) => updateLeagueField('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Add any league-specific notes..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Roster Structure */}
          <div className="border-b border-white/10">
            <button
              onClick={() => toggleSection('roster-structure')}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-semibold text-sm">Roster Structure</span>
              <span className="text-xl">{expandedSection === 'roster-structure' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'roster-structure' && (
              <div className="px-5 py-4 space-y-3 bg-white/5">
                {POSITION_SLOTS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm text-white/80">{label}</label>
                    <input
                      type="number"
                      value={editedLeague.lineup_slots[key] || 0}
                      onChange={(e) => updateSlotCount(key, parseInt(e.target.value) || 0)}
                      min="0"
                      max="20"
                      className="w-20 px-2 py-1 bg-slate-800 border border-white/20 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Scoring Settings */}
          <div className="border-b border-white/10">
            <button
              onClick={() => toggleSection('scoring-settings')}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-semibold text-sm">Scoring Settings</span>
              <span className="text-xl">{expandedSection === 'scoring-settings' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'scoring-settings' && (
              <div className="px-5 py-4 space-y-6 bg-white/5">
                {/* Skater Stats */}
                <div>
                  <h4 className="text-xs font-semibold text-cyan-300 mb-3 uppercase tracking-wider">
                    Skater Scoring
                  </h4>
                  <div className="space-y-2">
                    {COMMON_SKATER_STATS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <label className="text-sm text-white/80">{label}</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editedLeague.skater_scoring?.[key] || 0}
                          onChange={(e) => updateSkaterStat(key, parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.currentTarget.select()}
                          className="w-24 px-2 py-1 bg-slate-800 border border-white/20 rounded text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Goalie Stats */}
                <div>
                  <h4 className="text-xs font-semibold text-cyan-300 mb-3 uppercase tracking-wider">
                    Goalie Scoring
                  </h4>
                  <div className="space-y-2">
                    {COMMON_GOALIE_STATS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <label className="text-sm text-white/80">{label}</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editedLeague.goalie_scoring?.[key] || 0}
                          onChange={(e) => updateGoalieStat(key, parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.currentTarget.select()}
                          className="w-24 px-2 py-1 bg-slate-800 border border-white/20 rounded text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* League Weeks Wizard Modal */}
      <LeagueWeeksWizard
        isOpen={isLeagueWeeksOpen}
        onClose={() => setIsLeagueWeeksOpen(false)}
        onConfirm={(config: LeagueWeekConfig) => {
          // Store the week configuration in notes for now
          // (You may want to add a proper field to LeagueProfile later)
          const weeksInfo = `Playoff weeks: ${config.selectedWeeks.join(', ')} (starting ${config.weekStartDay})`;
          updateLeagueField('notes', editedLeague.notes ? `${editedLeague.notes}\n${weeksInfo}` : weeksInfo);
          setIsLeagueWeeksOpen(false);
        }}
      />
    </>
  );
}
