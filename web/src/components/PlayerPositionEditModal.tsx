import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
        const newPositions = prev.filter(p => p !== position);
        return newPositions;
      } else {
        setError(null);
        const newPositions = [...prev, position].sort((a, b) => {
          const order = ['C', 'LW', 'RW', 'D', 'G'];
          return order.indexOf(a) - order.indexOf(b);
        });
        return newPositions;
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
      console.error('[Modal] onSave failed:', err);
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-surface-glass backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-surface-2 rounded-2xl shadow-2xl border border-line w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-b from-surface-2 to-surface-2 border-b border-line p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink mb-1">
                Edit Position Eligibility
              </h2>
              <p className="text-ink-dim text-xs">
                {player.full_name} • {player.team}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 hover:bg-surface-1/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6 text-ink-dim" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Positions */}
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">
              Current Positions
            </label>
            <div className="text-ink-dim text-sm">
              {player.positions.join(' / ') || 'None'}
            </div>
          </div>

          {/* Position Selection */}
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">
              Select Positions
            </label>
            <div className="space-y-1.5">
              {AVAILABLE_POSITIONS.map(({ value, label, category }) => {
                const isSelected = selectedPositions.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => togglePosition(value)}
                    disabled={isSaving}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-lg border transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isSelected
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-line bg-surface-2 text-ink-dim hover:border-line hover:bg-surface-2'
                      }
                    `}
                  >
                    <span className="font-medium">{label}</span>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                        <Check className="w-4 h-4 text-ink" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="position-notes" className="block text-sm font-medium text-ink-dim mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="position-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              placeholder="e.g., Yahoo granted LW eligibility on 2024-12-07"
              className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink placeholder-ink-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:opacity-50"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-negative-muted border border-negative rounded-lg">
              <p className="text-negative text-sm">{error}</p>
            </div>
          )}

          {/* Preview */}
          {hasChanges && (
            <div className="p-4 bg-surface-2 border border-line rounded-lg">
              <div className="text-sm text-ink-dim mb-1">New Position Eligibility:</div>
              <div className="text-lg font-bold text-accent">
                {selectedPositions.join(' / ')}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 bg-surface-2 text-ink-dim rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-6 py-2.5 bg-accent text-ink rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-line border-t-white rounded-full animate-spin" />
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

  return createPortal(modalContent, document.body);
};
