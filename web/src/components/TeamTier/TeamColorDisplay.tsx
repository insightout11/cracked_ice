import React, { useState, useRef, useEffect } from 'react';
import { TeamTierData, TIER_COLORS } from '../../types/teamTiers';
import { useTeamTierSettings } from '../../contexts/TeamTierContext';

interface TeamColorDisplayProps {
  teamCode: string;
  teamTier?: TeamTierData;
  className?: string;
  showTooltip?: boolean;
  children?: React.ReactNode;
}

interface TooltipProps {
  teamTier: TeamTierData;
  show: boolean;
  position: { x: number; y: number };
}

const TeamTierTooltip: React.FC<TooltipProps> = ({ teamTier, show, position }) => {
  if (!show || !teamTier) return null;

  return (
    <div
      className={`team-tier-tooltip ${show ? 'show' : ''}`}
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="team-tier-tooltip-title">
        {teamTier.teamCode} ({teamTier.teamName})
      </div>

      <div className="team-tier-tooltip-stat">
        Games before playoffs: {teamTier.regularSeasonGames}
      </div>

      <div className="team-tier-tooltip-stat">
        Regular season off-nights: {(teamTier.regularSeasonOffNightPct * 100).toFixed(1)}%
      </div>

      <div className="team-tier-tooltip-stat">
        Playoff games: {teamTier.playoffGames}
      </div>

      <div className="team-tier-tooltip-stat">
        Playoff off-nights: {(teamTier.playoffOffNightPct * 100).toFixed(1)}%
      </div>

      <div className="team-tier-tooltip-explanation">
        {teamTier.tierExplanation}
      </div>
    </div>
  );
};

export const TeamColorDisplay: React.FC<TeamColorDisplayProps> = ({
  teamCode,
  teamTier,
  className = '',
  showTooltip = true,
  children
}) => {
  const { settings } = useTeamTierSettings();
  const [showTooltipState, setShowTooltipState] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (!showTooltip || !teamTier || !settings.showScheduleColors) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Calculate tooltip position
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY
    });

    // Show tooltip after a short delay
    timeoutRef.current = setTimeout(() => {
      setShowTooltipState(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    // Clear timeout if mouse leaves before tooltip shows
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setShowTooltipState(false);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (!showTooltip || !teamTier || !settings.showScheduleColors) return;

    event.preventDefault();

    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY
    });

    setShowTooltipState(true);

    // Hide tooltip after 3 seconds on mobile
    timeoutRef.current = setTimeout(() => {
      setShowTooltipState(false);
    }, 3000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // If schedule colors are disabled, render without colors
  if (!settings.showScheduleColors) {
    return (
      <span className={className} ref={elementRef}>
        {children || teamCode}
      </span>
    );
  }

  // If no tier data, render in default color
  if (!teamTier) {
    return (
      <span className={`team-tier ${className}`} ref={elementRef}>
        {children || teamCode}
      </span>
    );
  }

  // Determine CSS classes based on tier
  const tierClass = `team-tier-${teamTier.tier}`;
  const glowClass = showTooltip ? 'team-tier-glow' : '';

  return (
    <>
      <span
        ref={elementRef}
        className={`team-tier ${tierClass} ${glowClass} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        style={{
          color: TIER_COLORS[teamTier.tier]
        }}
      >
        {children || teamCode}
      </span>

      {showTooltip && (
        <TeamTierTooltip
          teamTier={teamTier}
          show={showTooltipState}
          position={tooltipPosition}
        />
      )}
    </>
  );
};

export default TeamColorDisplay;