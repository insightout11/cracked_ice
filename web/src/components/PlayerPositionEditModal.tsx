import React, { useState, useEffect } from 'react';
import { RosterPlayer } from '../lib/coachSchemas';
import { X, Check } from 'lucide-react';

interface PlayerPositionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer;
  onSave: (positions: string[], notes?: string) => Promise<void>;
}

const AVAILABLE_POSITIONS = [
  { value: 'C', label: 'Center (C)', category: 'forward' },
  { value: 'LW', label: 'Left Wing (LW)', category: 'forward' },
  { value: 'RW', label: 'Right Wing (RW)', category: 'forward' },
  { value: 'D', label: 'Defenseman (D)', category: 'defense' },
  { value: 'G', label: 'Goalie (G)', category: 'goalie' },
] as const;

export const PlayerPositionEditModal: React.FC<PlayerPositionEditModalProps> = ({
  isOpen,
  onClose,
  player,
  onSave,
}) => {
  const [selectedPositions, setSelectedPositions] = useState<string[]>(player.positions || []);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPositions(player.positions || []);
      setNotes('');
      setError(null);
    }
  }, [isOpen, player]);

  const togglePosition = (position: string) => {
    setSelectedPositions(prev => {
      if (prev.includes(position)) {
        // Don't allow removing the last position
        if (prev.length === 1) {
          setError('Player must have at least one position');
          return prev;
        }
        setError(null);
        return prev.filter(p => p !== position);
      } else {
        setError(null);
        return [...prev, position].sort((a, b) => {
          const order = ['C', 'LW', 'RW', 'D', 'G'];
          return order.indexOf(a) - order.indexOf(b);
        });
      }
    });
  };

  const handleSave = async () => {
    if (selectedPositions.length === 0) {
      setError('Please select at least one position');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(selectedPositions, notes || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save position changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSaving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasChanges = JSON.stringify(selectedPositions) !== JSON.stringify(player.positions);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-slate-950 rounded-2xl shadow-2xl border border-slate-800/50 w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Edit Position Eligibility
              </h2>
              <p className="text-slate-400 text-sm">
                {player.full_name} • {player.team}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Positions */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Current Positions
            </label>
            <div className="text-slate-400 text-sm">
              {player.positions.join(' / ') || 'None'}
            </div>
          </div>

          {/* Position Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select Positions
            </label>
            <div className="space-y-2">
              {AVAILABLE_POSITIONS.map(({ value, label, category }) => {
                const isSelected = selectedPositions.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => togglePosition(value)}
                    disabled={isSaving}
                    className={`
                      w-full flex items-center justify-between p-4 rounded-lg border transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                      }
                    `}
                  >
                    <span className="font-medium">{label}</span>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="position-notes" className="block text-sm font-medium text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="position-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              placeholder="e.g., Yahoo granted LW eligibility on 2024-12-07"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preview */}
          {hasChanges && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">New Position Eligibility:</div>
              <div className="text-lg font-bold text-cyan-400">
                {selectedPositions.join(' / ')}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-6 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
