import { useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';

export type AppSection = 'ice-level' | 'press-box' | 'front-office';

interface MobileHeaderProps {
  currentSection: AppSection;
  onSectionChange?: (section: AppSection) => void;
  leagueName?: string;
  onSettingsClick?: () => void;
}

const sections: { id: AppSection; label: string }[] = [
  { id: 'ice-level', label: 'Ice Level' },
  { id: 'press-box', label: 'Press Box' },
  { id: 'front-office', label: 'Front Office' },
];

/**
 * MobileHeader - App-level header with section navigation
 *
 * Layout:
 * [Section Dropdown]     [League Name]     [Settings]
 *
 * Allows switching between Ice Level, Press Box, and Front Office
 */
export function MobileHeader({
  currentSection,
  onSectionChange,
  leagueName,
  onSettingsClick,
}: MobileHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentSectionLabel = sections.find(s => s.id === currentSection)?.label || 'Ice Level';

  const handleSectionSelect = (section: AppSection) => {
    onSectionChange?.(section);
    setIsDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Section Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
          >
            <span className="text-sm font-semibold text-cyan-400">
              {currentSectionLabel}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsDropdownOpen(false)}
              />
              {/* Menu */}
              <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleSectionSelect(section.id)}
                    className={`
                      w-full text-left px-4 py-3 text-sm transition-colors
                      ${section.id === currentSection
                        ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                        : 'text-slate-200 hover:bg-slate-700 active:bg-slate-600'
                      }
                    `}
                    role="option"
                    aria-selected={section.id === currentSection}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* League Name (Center) */}
        <div className="flex-1 text-center px-4">
          <h1 className="text-sm font-medium text-white truncate">
            {leagueName || 'My League'}
          </h1>
        </div>

        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
