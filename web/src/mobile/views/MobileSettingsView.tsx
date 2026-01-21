import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Save } from 'lucide-react';
import type { LeagueProfile } from '../../lib/coachSchemas';

// Presets from LeagueSettingsDrawer
const PRESETS: Record<string, Partial<LeagueProfile>> = {
  'Chesterfield League': {
    num_teams: 10,
    scoring_type: 'points',
    lineup_slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4, IR: 1, 'IR+': 1 },
    skater_scoring: { goals: 1.3, assists: 1.3, powerplay_points: 1, shorthanded_goals: 3, shorthanded_assists: 2, game_winning_goals: 1, shots_on_goal: 0.1, hits: 0.1, blocks: 0.1 },
    goalie_scoring: { wins: 2, saves: 0.1, goals_against: -0.5, shutouts: 2 },
  },
  'KKUPFL': {
    num_teams: 14,
    scoring_type: 'points',
    lineup_slots: { C: 2, LW: 2, RW: 2, UTIL: 2, D: 4, G: 2, BN: 4 },
    skater_scoring: { goals: 4.5, assists: 3, shots_on_goal: 0.5, shorthanded_goals: 2, shorthanded_assists: 2, blocks: 0.5, hits: 0.25 },
    goalie_scoring: { wins: 3, saves: 0.30, goals_against: -1.5, shutouts: 3 },
  },
  'APL': {
    num_teams: 12,
    scoring_type: 'points',
    lineup_slots: { C: 3, LW: 3, RW: 3, D: 4, UTIL: 1, G: 2, BN: 4, 'IR+': 5 },
    skater_scoring: { goals: 5, assists: 3.75, shots_on_goal: 0.5, powerplay_points: 0.5, hits: 0.3, blocks: 0.6 },
    goalie_scoring: { wins: 2.75, saves: 0.35, goals_against: -1.5, shutouts: 3 },
  },
  'Yahoo Standard': {
    num_teams: 12,
    scoring_type: 'points',
    lineup_slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4, IR: 2 },
    skater_scoring: { goals: 6, assists: 4, power_play_points: 2, shorthanded_goals: 4, shots_on_goal: 0.9, blocks: 1, hits: 0.5, plus_minus: 2 },
    goalie_scoring: { wins: 5, saves: 0.6, goals_against: -3, shutouts: 3 },
  },
  'ESPN Standard': {
    num_teams: 12,
    scoring_type: 'points',
    lineup_slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4, IR: 1, 'IR+': 1 },
    skater_scoring: { goals: 3, assists: 2, power_play_points: 1, shorthanded_goals: 2, shots_on_goal: 0.4, blocks: 0.4, hits: 0.2, plus_minus: 0.25 },
    goalie_scoring: { wins: 5, saves: 0.6, goals_against: -3, shutouts: 5 },
  },
};

const POSITION_SLOTS = [
  { key: 'C', label: 'Center' },
  { key: 'LW', label: 'Left Wing' },
  { key: 'RW', label: 'Right Wing' },
  { key: 'D', label: 'Defense' },
  { key: 'G', label: 'Goalie' },
  { key: 'UTIL', label: 'Utility' },
  { key: 'F', label: 'Forward' },
  { key: 'BN', label: 'Bench' },
  { key: 'IR', label: 'IR' },
  { key: 'IR+', label: 'IR+' },
];

interface MobileSettingsViewProps {
  leagueProfile: LeagueProfile;
  onSave: (profile: LeagueProfile) => void;
}

export function MobileSettingsView({ leagueProfile, onSave }: MobileSettingsViewProps) {
  const [editedProfile, setEditedProfile] = useState<LeagueProfile>(leagueProfile);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['info']));
  const [hasChanges, setHasChanges] = useState(false);

  // Reset when leagueProfile changes
  useEffect(() => {
    setEditedProfile(leagueProfile);
    setHasChanges(false);
  }, [leagueProfile]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handlePresetChange = (presetName: string) => {
    if (presetName && PRESETS[presetName]) {
      const preset = PRESETS[presetName];
      setEditedProfile({
        ...editedProfile,
        preset_name: presetName,
        num_teams: preset.num_teams ?? editedProfile.num_teams,
        scoring_type: preset.scoring_type ?? editedProfile.scoring_type,
        lineup_slots: preset.lineup_slots ?? editedProfile.lineup_slots,
        skater_scoring: preset.skater_scoring ?? editedProfile.skater_scoring,
        goalie_scoring: preset.goalie_scoring ?? editedProfile.goalie_scoring,
      });
      setHasChanges(true);
    }
  };

  const updateField = (field: keyof LeagueProfile, value: any) => {
    setEditedProfile({ ...editedProfile, [field]: value });
    setHasChanges(true);
  };

  const updateSlot = (slot: string, count: number) => {
    setEditedProfile({
      ...editedProfile,
      lineup_slots: {
        ...editedProfile.lineup_slots,
        [slot]: Math.max(0, count),
      },
    });
    setHasChanges(true);
  };

  const updateSkaterScoring = (stat: string, value: number) => {
    setEditedProfile({
      ...editedProfile,
      skater_scoring: {
        ...(editedProfile.skater_scoring || {}),
        [stat]: value,
      },
    });
    setHasChanges(true);
  };

  const updateGoalieScoring = (stat: string, value: number) => {
    setEditedProfile({
      ...editedProfile,
      goalie_scoring: {
        ...(editedProfile.goalie_scoring || {}),
        [stat]: value,
      },
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(editedProfile);
    setHasChanges(false);
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md px-4 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">League Settings</h1>
            <p className="text-sm text-slate-400 mt-1">Configure your league</p>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Preset Selector */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wide mb-2">
            Preset
          </label>
          <select
            value={editedProfile.preset_name || ''}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-3 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Custom</option>
            {Object.keys(PRESETS).map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
        </div>

        {/* League Info Section */}
        <CollapsibleSection
          title="League Info"
          isExpanded={expandedSections.has('info')}
          onToggle={() => toggleSection('info')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">League Name</label>
              <input
                type="text"
                value={editedProfile.league_name || ''}
                onChange={(e) => updateField('league_name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Number of Teams</label>
              <input
                type="number"
                value={editedProfile.num_teams || 12}
                onChange={(e) => updateField('num_teams', parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Scoring Type</label>
              <select
                value={editedProfile.scoring_type || 'points'}
                onChange={(e) => updateField('scoring_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="points">Points</option>
                <option value="categories">Categories</option>
                <option value="head-to-head">Head-to-Head</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>

        {/* Roster Slots Section */}
        <CollapsibleSection
          title="Roster Slots"
          isExpanded={expandedSections.has('slots')}
          onToggle={() => toggleSection('slots')}
        >
          <div className="grid grid-cols-2 gap-3">
            {POSITION_SLOTS.map((slot) => {
              const count = editedProfile.lineup_slots?.[slot.key] ?? 0;
              if (count === 0 && !['C', 'LW', 'RW', 'D', 'G', 'BN'].includes(slot.key)) return null;
              return (
                <div key={slot.key} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                  <span className="text-sm text-slate-300">{slot.label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSlot(slot.key, count - 1)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded text-white hover:bg-slate-600"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-white font-medium">{count}</span>
                    <button
                      onClick={() => updateSlot(slot.key, count + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded text-white hover:bg-slate-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* Skater Scoring Section */}
        <CollapsibleSection
          title="Skater Scoring"
          isExpanded={expandedSections.has('skater')}
          onToggle={() => toggleSection('skater')}
        >
          <div className="space-y-3">
            {Object.entries(editedProfile.skater_scoring || {}).map(([stat, value]) => (
              <div key={stat} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-slate-300 capitalize">{stat.replace(/_/g, ' ')}</span>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => updateSkaterScoring(stat, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-right focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Goalie Scoring Section */}
        <CollapsibleSection
          title="Goalie Scoring"
          isExpanded={expandedSections.has('goalie')}
          onToggle={() => toggleSection('goalie')}
        >
          <div className="space-y-3">
            {Object.entries(editedProfile.goalie_scoring || {}).map(([stat, value]) => (
              <div key={stat} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-slate-300 capitalize">{stat.replace(/_/g, ' ')}</span>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => updateGoalieScoring(stat, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-right focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Bottom padding */}
        <div className="h-24" />
      </div>
    </div>
  );
}

// Helper Component
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isExpanded, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
      >
        <span className="font-semibold text-white">{title}</span>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-cyan-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
