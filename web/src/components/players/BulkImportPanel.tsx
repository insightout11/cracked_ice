import React, { useState } from 'react';
import type { PlayerSearchResult } from '../../types';

interface BulkImportPanelProps {
  allPlayers: PlayerSearchResult[];
  onImport: (playerIds: string[]) => void;
  onOcrUpload?: (file: File) => Promise<string[]>; // Optional OCR handler
  mode?: 'free-agents' | 'roster'; // Default: 'free-agents'
}

export const BulkImportPanel: React.FC<BulkImportPanelProps> = ({
  allPlayers,
  onImport,
  onOcrUpload,
  mode = 'free-agents',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState<{
    matched: Array<{ name: string; player: PlayerSearchResult }>;
    unmatched: string[];
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse input text and match against player database
  const parseAndMatch = (text: string) => {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const matched: Array<{ name: string; player: PlayerSearchResult }> = [];
    const unmatched: string[] = [];

    lines.forEach(name => {
      // Try to find player by name (case-insensitive, fuzzy match)
      const normalizedName = name.toLowerCase();
      const player = allPlayers.find(p => {
        const playerName = (p.name || '').toLowerCase();
        // Exact match or contains
        return playerName === normalizedName || playerName.includes(normalizedName) || normalizedName.includes(playerName);
      });

      if (player) {
        matched.push({ name, player });
      } else {
        unmatched.push(name);
      }
    });

    return { matched, unmatched };
  };

  // Handle preview generation
  const handlePreview = () => {
    if (!inputText.trim()) {
      setPreview(null);
      return;
    }

    const result = parseAndMatch(inputText);
    setPreview(result);
  };

  // Handle import confirmation
  const handleConfirmImport = () => {
    if (!preview || preview.matched.length === 0) return;

    const playerIds = preview.matched.map(m => m.player.id);
    onImport(playerIds);

    // Reset state
    setInputText('');
    setPreview(null);
    setIsExpanded(false);
  };

  // Handle OCR upload
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onOcrUpload) return;

    setIsProcessing(true);
    try {
      const names = await onOcrUpload(file);
      setInputText(names.join('\n'));
      const result = parseAndMatch(names.join('\n'));
      setPreview(result);
    } catch (error) {
      console.error('OCR upload failed:', error);
      alert('Failed to process screenshot. Please try pasting names manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-surface-1/5 hover:bg-surface-1/10 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">Bulk Import Players</span>
          <span className="text-xs text-ink-dim">
            (Paste names or upload screenshot)
          </span>
        </div>
        <span className="text-xl text-ink">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-surface-1/5">
          {/* Instructions */}
          <p className="text-sm text-ink-dim">
            {mode === 'roster'
              ? 'Paste player names (one per line) or upload a screenshot. Matched players will be added to your roster.'
              : 'Paste player names (one per line) or upload a screenshot. Matched players will be marked as Free Agents.'}
          </p>

          {/* Input Area */}
          <div className="space-y-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Alex Killorn&#10;Chris Kreider&#10;Tyler Bertuzzi&#10;..."
              rows={6}
              className="w-full px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink placeholder-ink-dim text-sm focus:outline-none focus:border-accent font-mono"
            />

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!inputText.trim() || isProcessing}
                className="px-4 py-2 bg-accent-muted text-accent rounded text-sm font-medium hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview Matches
              </button>

              {onOcrUpload && (
                <label className="px-4 py-2 bg-accent-muted text-accent rounded text-sm font-medium hover:bg-accent-muted transition-colors cursor-pointer">
                  {isProcessing ? 'Processing...' : 'Upload Screenshot'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOcrUpload}
                    disabled={isProcessing}
                    className="hidden"
                  />
                </label>
              )}

              {preview && (
                <button
                  onClick={() => {
                    setInputText('');
                    setPreview(null);
                  }}
                  className="px-4 py-2 bg-surface-1/10 text-ink-dim rounded text-sm font-medium hover:bg-surface-1/20 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Preview Results */}
          {preview && (
            <div className="space-y-3 border-t border-line pt-4">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-positive font-medium">
                  ✓ {preview.matched.length} matched
                </span>
                {preview.unmatched.length > 0 && (
                  <span className="text-negative font-medium">
                    ✗ {preview.unmatched.length} unmatched
                  </span>
                )}
              </div>

              {/* Matched Players */}
              {preview.matched.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-accent uppercase tracking-wider">
                    Matched Players
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {preview.matched.map((match, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-ink-dim bg-surface-1/5 rounded px-2 py-1 flex items-center justify-between"
                      >
                        <span>{match.player.name}</span>
                        <span className="text-xs text-ink-mute">
                          {match.player.team} • {Array.isArray(match.player.pos) ? match.player.pos.join('/') : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched Names */}
              {preview.unmatched.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-negative uppercase tracking-wider">
                    Unmatched Names
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {preview.unmatched.map((name, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-negative bg-negative-muted rounded px-2 py-1"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-ink-dim italic">
                    These names could not be matched. Check spelling or add them manually.
                  </p>
                </div>
              )}

              {/* Confirm Button */}
              {preview.matched.length > 0 && (
                <button
                  onClick={handleConfirmImport}
                  className="w-full px-4 py-2 bg-positive-muted text-positive rounded font-medium hover:bg-positive-muted transition-colors"
                >
                  {mode === 'roster'
                    ? `Add ${preview.matched.length} Player${preview.matched.length !== 1 ? 's' : ''} to Roster`
                    : `Import ${preview.matched.length} Player${preview.matched.length !== 1 ? 's' : ''} as Free Agents`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
