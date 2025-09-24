import React from 'react';
import { TIER_DESCRIPTIONS } from '../../types/teamTiers';
import { useTeamTierSettings } from '../../contexts/TeamTierContext';

interface TierLegendProps {
  className?: string;
  compact?: boolean;
}

export const TierLegend: React.FC<TierLegendProps> = ({
  className = '',
  compact = false
}) => {
  const { settings } = useTeamTierSettings();

  if (!settings.showScheduleColors) {
    return null;
  }

  return (
    <div className={`team-tier-legend ${className}`}>
      <div className="team-tier-legend-item">
        <div className="team-tier-legend-dot cyan"></div>
        <span>{compact ? 'Elite' : TIER_DESCRIPTIONS.cyan}</span>
      </div>

      <div className="team-tier-legend-item">
        <div className="team-tier-legend-dot blue"></div>
        <span>{compact ? 'Playoff' : TIER_DESCRIPTIONS.blue}</span>
      </div>

      <div className="team-tier-legend-item">
        <div className="team-tier-legend-dot green"></div>
        <span>{compact ? 'Regular' : TIER_DESCRIPTIONS.green}</span>
      </div>

      <div className="team-tier-legend-item">
        <div className="team-tier-legend-dot red"></div>
        <span>{compact ? 'Below Avg' : TIER_DESCRIPTIONS.red}</span>
      </div>
    </div>
  );
};

export default TierLegend;