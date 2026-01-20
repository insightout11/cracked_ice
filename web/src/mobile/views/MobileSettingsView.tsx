import { useState } from 'react';
import { ChevronRight, ChevronDown, Info, Sliders, Users, Calendar, Award } from 'lucide-react';

interface LeagueInfo {
  name: string;
  teams: number;
  scoringType: string;
  platform?: string;
}

interface RosterStructure {
  forwards: number;
  defense: number;
  goalies: number;
  bench: number;
  ir: number;
}

interface ScoringWeight {
  category: string;
  value: number;
}

interface MobileSettingsViewProps {
  leagueInfo?: LeagueInfo;
  rosterStructure?: RosterStructure;
  skaterWeights?: ScoringWeight[];
  goalieWeights?: ScoringWeight[];
  onEditLeagueInfo?: () => void;
  onEditRosterStructure?: () => void;
  onSaveChanges?: () => void;
  isLoading?: boolean;
}

/**
 * MobileSettingsView - League settings and scoring weights
 *
 * Features:
 * - League info display
 * - Roster structure
 * - Collapsible scoring weight sections
 * - Read-only display (editing via sheets)
 */
export function MobileSettingsView({
  leagueInfo,
  rosterStructure,
  skaterWeights = [],
  goalieWeights = [],
  onEditLeagueInfo,
  onEditRosterStructure,
  onSaveChanges,
  isLoading = false,
}: MobileSettingsViewProps) {
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md px-4 py-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">League configuration & scoring weights</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* League Info Section */}
        <SettingsSection
          icon={Info}
          title="League Info"
          onTap={onEditLeagueInfo}
        >
          <div className="space-y-3">
            <SettingsRow label="League Name" value={leagueInfo?.name || 'Not set'} />
            <SettingsRow label="Teams" value={leagueInfo?.teams?.toString() || '—'} />
            <SettingsRow label="Scoring Type" value={leagueInfo?.scoringType || '—'} />
            {leagueInfo?.platform && (
              <SettingsRow label="Platform" value={leagueInfo.platform} />
            )}
          </div>
        </SettingsSection>

        {/* Roster Structure Section */}
        <SettingsSection
          icon={Users}
          title="Roster Structure"
          onTap={onEditRosterStructure}
        >
          <div className="grid grid-cols-2 gap-3">
            <StructureCard label="Forwards" value={rosterStructure?.forwards ?? 0} positions="C/LW/RW" />
            <StructureCard label="Defense" value={rosterStructure?.defense ?? 0} positions="D" />
            <StructureCard label="Goalies" value={rosterStructure?.goalies ?? 0} positions="G" />
            <StructureCard label="Bench" value={rosterStructure?.bench ?? 0} positions="BN" />
            <StructureCard label="IR/IR+" value={rosterStructure?.ir ?? 0} positions="IR" />
          </div>
        </SettingsSection>

        {/* Skater Scoring Weights */}
        <CollapsibleSection
          icon={Award}
          title="Skater Scoring"
          isExpanded={expandedSections.has('skater')}
          onToggle={() => toggleSection('skater')}
          itemCount={skaterWeights.length}
        >
          {skaterWeights.length === 0 ? (
            <p className="text-sm text-slate-500">No skater weights configured</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {skaterWeights.map((weight) => (
                <WeightRow
                  key={weight.category}
                  category={weight.category}
                  value={weight.value}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Goalie Scoring Weights */}
        <CollapsibleSection
          icon={Sliders}
          title="Goalie Scoring"
          isExpanded={expandedSections.has('goalie')}
          onToggle={() => toggleSection('goalie')}
          itemCount={goalieWeights.length}
        >
          {goalieWeights.length === 0 ? (
            <p className="text-sm text-slate-500">No goalie weights configured</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {goalieWeights.map((weight) => (
                <WeightRow
                  key={weight.category}
                  category={weight.category}
                  value={weight.value}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Time Window Section */}
        <SettingsSection
          icon={Calendar}
          title="Analysis Time Window"
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Configure the date range for roster analysis and projections.
            </p>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-sm text-slate-300">Current Window</span>
              <span className="text-sm font-medium text-cyan-400">Next 7 Days</span>
            </div>
          </div>
        </SettingsSection>

        {/* Data Source */}
        <div className="mt-6 px-4 py-3 bg-slate-800/30 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Data Source</span>
            <span className="text-xs text-slate-400">{leagueInfo?.platform || 'Yahoo Fantasy'}</span>
          </div>
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-24" />
      </div>
    </div>
  );
}

// Helper Components

interface SettingsSectionProps {
  icon: typeof Info;
  title: string;
  onTap?: () => void;
  children: React.ReactNode;
}

function SettingsSection({ icon: Icon, title, onTap, children }: SettingsSectionProps) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onTap}
        disabled={!onTap}
        className={`w-full flex items-center justify-between p-4 ${
          onTap ? 'hover:bg-slate-800/50 active:bg-slate-700/50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-semibold text-white">{title}</span>
        </div>
        {onTap && <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>

      {/* Section Content */}
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

interface CollapsibleSectionProps {
  icon: typeof Info;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  itemCount?: number;
  children: React.ReactNode;
}

function CollapsibleSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  itemCount,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 active:bg-slate-700/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-semibold text-white">{title}</span>
          {itemCount !== undefined && (
            <span className="text-xs text-slate-400">({itemCount})</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-cyan-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Section Content */}
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function StructureCard({
  label,
  value,
  positions,
}: {
  label: string;
  value: number;
  positions: string;
}) {
  return (
    <div className="p-3 bg-slate-800/50 rounded-lg text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{positions}</div>
    </div>
  );
}

function WeightRow({ category, value }: { category: string; value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
      <span className="text-xs text-slate-400 truncate">{category}</span>
      <span
        className={`text-xs font-bold ${
          isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-400'
        }`}
      >
        {isPositive ? '+' : ''}{value}
      </span>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="px-4 pt-4 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-700 rounded w-32 mb-2" />
      <div className="h-4 bg-slate-700 rounded w-48 mb-6" />

      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-800/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-700" />
            <div className="h-5 bg-slate-700 rounded w-32" />
          </div>
          <div className="space-y-2">
            <div className="h-10 bg-slate-700 rounded" />
            <div className="h-10 bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
