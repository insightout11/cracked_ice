import { useState } from 'react';
import type { LeagueProfile, SkaterScoringWeights, GoalieScoringWeights } from '../types';
import { PlayoffDatePicker } from './TimeWindow/PlayoffDatePicker';

interface LeagueSettingsFormProps {
  initialSettings?: LeagueProfile;
  onSave: (settings: LeagueProfile) => Promise<void>;
  onCancel?: () => void;
}

// Stat definitions with display names and abbreviations
const SKATER_STATS = [
  { key: 'goals', label: 'Goals', abbr: 'G', category: 'Offensive' },
  { key: 'assists', label: 'Assists', abbr: 'A', category: 'Offensive' },
  { key: 'points', label: 'Points', abbr: 'P', category: 'Offensive' },
  { key: 'plus_minus', label: 'Plus/Minus', abbr: '+/-', category: 'Offensive' },
  { key: 'penalty_minutes', label: 'Penalty Minutes', abbr: 'PIM', category: 'Offensive' },

  { key: 'powerplay_goals', label: 'Power Play Goals', abbr: 'PPG', category: 'Power Play' },
  { key: 'powerplay_assists', label: 'Power Play Assists', abbr: 'PPA', category: 'Power Play' },
  { key: 'powerplay_points', label: 'Power Play Points', abbr: 'PPP', category: 'Power Play' },

  { key: 'shorthanded_goals', label: 'Shorthanded Goals', abbr: 'SHG', category: 'Shorthanded' },
  { key: 'shorthanded_assists', label: 'Shorthanded Assists', abbr: 'SHA', category: 'Shorthanded' },
  { key: 'shorthanded_points', label: 'Shorthanded Points', abbr: 'SHP', category: 'Shorthanded' },

  { key: 'game_winning_goals', label: 'Game Winning Goals', abbr: 'GWG', category: 'Special' },
  { key: 'game_tying_goals', label: 'Game Tying Goals', abbr: 'GTG', category: 'Special' },
  { key: 'hat_tricks', label: 'Hat Tricks', abbr: 'HAT', category: 'Special' },

  { key: 'shots_on_goal', label: 'Shots on Goal', abbr: 'SOG', category: 'Shooting' },
  { key: 'shooting_percentage', label: 'Shooting %', abbr: 'SH%', category: 'Shooting' },

  { key: 'faceoffs_won', label: 'Faceoffs Won', abbr: 'FW', category: 'Faceoffs' },
  { key: 'faceoffs_lost', label: 'Faceoffs Lost', abbr: 'FL', category: 'Faceoffs' },
  { key: 'faceoff_percentage', label: 'Faceoff %', abbr: 'FO%', category: 'Faceoffs' },

  { key: 'hits', label: 'Hits', abbr: 'HIT', category: 'Physical' },
  { key: 'blocks', label: 'Blocks', abbr: 'BLK', category: 'Physical' },

  { key: 'defensive_points', label: 'Defensive Points', abbr: 'DEF', category: 'Defensive' },
] as const;

const GOALIE_STATS = [
  { key: 'wins', label: 'Wins', abbr: 'W' },
  { key: 'losses', label: 'Losses', abbr: 'L' },
  { key: 'overtime_losses', label: 'Overtime Losses', abbr: 'OTL' },
  { key: 'goals_against', label: 'Goals Against', abbr: 'GA' },
  { key: 'goals_against_average', label: 'Goals Against Average', abbr: 'GAA' },
  { key: 'saves', label: 'Saves', abbr: 'SV' },
  { key: 'save_percentage', label: 'Save %', abbr: 'SV%' },
  { key: 'shots_against', label: 'Shots Against', abbr: 'SA' },
  { key: 'shutouts', label: 'Shutouts', abbr: 'SO' },
  { key: 'games_started', label: 'Games Started', abbr: 'GS' },
  { key: 'complete_games', label: 'Complete Games', abbr: 'CG' },
  { key: 'minutes', label: 'Minutes', abbr: 'MIN' },
] as const;

export function LeagueSettingsForm({ initialSettings, onSave, onCancel }: LeagueSettingsFormProps) {
  const [leagueName, setLeagueName] = useState(initialSettings?.league_name || '');
  const [scoringType, setScoringType] = useState<'points' | 'categories'>(
    initialSettings?.scoring_type || 'points'
  );
  const [presetName, setPresetName] = useState<string>(
    initialSettings?.preset_name || 'Yahoo Standard'
  );
  const [activeTab, setActiveTab] = useState<'skaters' | 'goalies'>('skaters');
  const [numTeams, setNumTeams] = useState<number>(initialSettings?.num_teams || 12);
  const [playoffStartDate, setPlayoffStartDate] = useState<string>(
    initialSettings?.playoff_start_date || ''
  );

  // Points league state
  const [skaterScoring, setSkaterScoring] = useState<SkaterScoringWeights>(
    initialSettings?.skater_scoring || {}
  );
  const [goalieScoring, setGoalieScoring] = useState<GoalieScoringWeights>(
    initialSettings?.goalie_scoring || {}
  );

  // Category league state
  const [skaterCategories, setSkaterCategories] = useState<string[]>(
    initialSettings?.skater_categories || []
  );
  const [goalieCategories, setGoalieCategories] = useState<string[]>(
    initialSettings?.goalie_categories || []
  );

  const [saving, setSaving] = useState(false);
  const [isPlayoffDatePickerOpen, setIsPlayoffDatePickerOpen] = useState(false);

  const handleSkaterScoreChange = (key: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setSkaterScoring(prev => ({ ...prev, [key]: numValue }));
    // Auto-switch to Custom preset when manually changing scoring
    if (presetName !== 'Custom') {
      setPresetName('Custom');
    }
  };

  const handleGoalieScoreChange = (key: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setGoalieScoring(prev => ({ ...prev, [key]: numValue }));
    // Auto-switch to Custom preset when manually changing scoring
    if (presetName !== 'Custom') {
      setPresetName('Custom');
    }
  };

  const handleSkaterCategoryToggle = (key: string) => {
    setSkaterCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleGoalieCategoryToggle = (key: string) => {
    setGoalieCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const settings: LeagueProfile = {
        league_name: leagueName,
        scoring_type: scoringType,
        preset_name: presetName,
        lineup_slots: initialSettings?.lineup_slots || {},
        num_teams: numTeams,
        playoff_start_date: playoffStartDate || undefined,
      };

      if (scoringType === 'points') {
        settings.skater_scoring = skaterScoring;
        settings.goalie_scoring = goalieScoring;
      } else {
        settings.skater_categories = skaterCategories;
        settings.goalie_categories = goalieCategories;
      }

      await onSave(settings);
    } finally {
      setSaving(false);
    }
  };

  // Group skater stats by category
  type SkaterStat = typeof SKATER_STATS[number];
  const skaterStatsByCategory = SKATER_STATS.reduce((acc, stat) => {
    if (!acc[stat.category]) {
      acc[stat.category] = [];
    }
    acc[stat.category].push(stat);
    return acc;
  }, {} as Record<string, SkaterStat[]>);

  return (
    <div className="space-y-6">
      {/* League Name */}
      <div>
        <label className="block text-sm font-medium text-[var(--ci-white)] mb-2">
          League Name
        </label>
        <input
          type="text"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="My Fantasy League"
          className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded-lg text-[var(--ci-white)] placeholder-[var(--ci-muted)] focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)]"
        />
      </div>

      {/* League Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--ci-white)] mb-2">
            Number of Teams
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={numTeams}
            onChange={(e) => setNumTeams(parseInt(e.target.value) || 12)}
            onFocus={(e) => e.target.select()}
            className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded-lg text-[var(--ci-white)] placeholder-[var(--ci-muted)] focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--ci-white)] mb-2">
            Playoff Start Date
          </label>
          <button
            type="button"
            onClick={() => setIsPlayoffDatePickerOpen(true)}
            className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded-lg text-[var(--ci-white)] hover:border-[var(--laser-cyan)] focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)] text-left"
          >
            {playoffStartDate ? (
              new Date(playoffStartDate + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            ) : (
              <span className="text-[var(--ci-muted)]">Select date...</span>
            )}
          </button>
        </div>
      </div>

      {/* League Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-[var(--ci-white)] mb-2">
          League Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScoringType('points')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              scoringType === 'points'
                ? 'bg-[var(--laser-cyan)] text-black'
                : 'bg-black/30 border border-white/20 text-[var(--ci-muted)] hover:border-[var(--laser-cyan)]/50'
            }`}
          >
            Points League
          </button>
          <button
            type="button"
            onClick={() => setScoringType('categories')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              scoringType === 'categories'
                ? 'bg-[var(--laser-cyan)] text-black'
                : 'bg-black/30 border border-white/20 text-[var(--ci-muted)] hover:border-[var(--laser-cyan)]/50'
            }`}
          >
            Category League
          </button>
        </div>
      </div>

      {/* Player Type Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('skaters')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'skaters'
                ? 'text-[var(--laser-cyan)] border-b-2 border-[var(--laser-cyan)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)]'
            }`}
          >
            Skaters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('goalies')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'goalies'
                ? 'text-[var(--laser-cyan)] border-b-2 border-[var(--laser-cyan)]'
                : 'text-[var(--ci-muted)] hover:text-[var(--ci-white)]'
            }`}
          >
            Goalies
          </button>
        </div>
      </div>

      {/* Stats Configuration */}
      <div className="max-h-[500px] overflow-y-auto pr-2">
        {activeTab === 'skaters' ? (
          <div className="space-y-6">
            {scoringType === 'points' ? (
              // Points League - Skaters
              Object.entries(skaterStatsByCategory).map(([category, stats]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--ci-white)] uppercase tracking-wide">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stats.map((stat) => (
                      <div key={stat.key} className="flex items-center gap-3">
                        <label className="flex-1 text-sm text-[var(--ci-white)]">
                          <span className="font-medium">{stat.abbr}</span>
                          <span className="text-[var(--ci-muted)] ml-2">{stat.label}</span>
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={skaterScoring[stat.key as keyof SkaterScoringWeights] ?? ''}
                          onChange={(e) => handleSkaterScoreChange(stat.key, e.target.value)}
                          onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                          placeholder="0"
                          className="w-24 px-3 py-1.5 bg-black/30 border border-white/20 rounded text-[var(--ci-white)] text-sm focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Category League - Skaters
              Object.entries(skaterStatsByCategory).map(([category, stats]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--ci-white)] uppercase tracking-wide">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.map((stat) => (
                      <label
                        key={stat.key}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={skaterCategories.includes(stat.key)}
                          onChange={() => handleSkaterCategoryToggle(stat.key)}
                          className="w-4 h-4 rounded border-white/20 bg-black/30 text-[var(--laser-cyan)] focus:ring-[var(--laser-cyan)] focus:ring-offset-0"
                        />
                        <span className="flex-1 text-sm text-[var(--ci-white)]">
                          <span className="font-medium">{stat.abbr}</span>
                          <span className="text-[var(--ci-muted)] ml-2">{stat.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {scoringType === 'points' ? (
              // Points League - Goalies
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALIE_STATS.map((stat) => (
                  <div key={stat.key} className="flex items-center gap-3">
                    <label className="flex-1 text-sm text-[var(--ci-white)]">
                      <span className="font-medium">{stat.abbr}</span>
                      <span className="text-[var(--ci-muted)] ml-2">{stat.label}</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={goalieScoring[stat.key as keyof GoalieScoringWeights] ?? ''}
                      onChange={(e) => handleGoalieScoreChange(stat.key, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 bg-black/30 border border-white/20 rounded text-[var(--ci-white)] text-sm focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)]"
                    />
                  </div>
                ))}
              </div>
            ) : (
              // Category League - Goalies
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOALIE_STATS.map((stat) => (
                  <label
                    key={stat.key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={goalieCategories.includes(stat.key)}
                      onChange={() => handleGoalieCategoryToggle(stat.key)}
                      className="w-4 h-4 rounded border-white/20 bg-black/30 text-[var(--laser-cyan)] focus:ring-[var(--laser-cyan)] focus:ring-offset-0"
                    />
                    <span className="flex-1 text-sm text-[var(--ci-white)]">
                      <span className="font-medium">{stat.abbr}</span>
                      <span className="text-[var(--ci-muted)] ml-2">{stat.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-black/30 border border-white/20 rounded-lg text-[var(--ci-white)] font-medium hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !leagueName.trim()}
          className="flex-1 px-4 py-2 bg-[var(--laser-cyan)] text-black rounded-lg font-medium hover:bg-[var(--laser-cyan)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-[var(--ci-muted)] text-center">
        {scoringType === 'points'
          ? 'Enter point values for each stat. Leave blank to ignore. Negative values are supported.'
          : 'Select which categories your league tracks. Unselected stats will not be counted.'}
      </p>

      {/* Playoff Date Picker Modal */}
      <PlayoffDatePicker
        isOpen={isPlayoffDatePickerOpen}
        onClose={() => setIsPlayoffDatePickerOpen(false)}
        onConfirm={(date) => {
          setPlayoffStartDate(date);
          setIsPlayoffDatePickerOpen(false);
        }}
        initialDate={playoffStartDate}
      />
    </div>
  );
}
