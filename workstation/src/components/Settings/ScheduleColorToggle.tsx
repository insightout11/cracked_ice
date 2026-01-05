import React from 'react';
import { useTeamTierSettings } from '../../contexts/TeamTierContext';

interface ScheduleColorToggleProps {
  className?: string;
  label?: string;
}

export const ScheduleColorToggle: React.FC<ScheduleColorToggleProps> = ({
  className = '',
  label = 'Show schedule colors'
}) => {
  const { settings, toggleShowColors } = useTeamTierSettings();

  return (
    <label className={`schedule-colors-toggle ${className}`}>
      <input
        type="checkbox"
        checked={settings.showScheduleColors}
        onChange={toggleShowColors}
      />
      <span>{label}</span>
    </label>
  );
};

export default ScheduleColorToggle;