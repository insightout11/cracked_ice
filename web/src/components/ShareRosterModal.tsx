import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, Copy, Share2, Loader2, CheckCircle2, Instagram } from 'lucide-react';
import { RosterShareFrame } from './RosterShareFrame';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import type { TeamTierData } from '../types/teamTiers';

export type ShareFormat = 'portrait-feed' | 'portrait-story' | 'landscape-standard' | 'landscape-highres';

export interface FormatOption {
  id: ShareFormat;
  label: string;
  description: string;
  dimensions: { width: number; height: number };
  aspectRatio: string;
  platforms: string[];
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'portrait-feed',
    label: 'Portrait — 4:5 (Feed)',
    description: 'Instagram Feed, Facebook',
    dimensions: { width: 1080, height: 1350 },
    aspectRatio: '4:5',
    platforms: ['Instagram', 'Facebook'],
  },
  {
    id: 'portrait-story',
    label: 'Portrait — 9:16 (Story/Reel)',
    description: 'Instagram Story, TikTok, Snapchat',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    platforms: ['Instagram Story', 'TikTok', 'Snapchat'],
  },
  {
    id: 'landscape-standard',
    label: 'Landscape — 16:9 (Twitter)',
    description: 'Twitter/X, Discord, Reddit',
    dimensions: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    platforms: ['Twitter/X', 'Discord', 'Reddit'],
  },
  {
    id: 'landscape-highres',
    label: 'Landscape — High-Res',
    description: 'Download for blogs, forums',
    dimensions: { width: 2560, height: 1700 },
    aspectRatio: '3:2',
    platforms: ['Download', 'Blogs', 'Forums'],
  },
];

interface ShareRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  getTeamTier?: (teamCode: string) => TeamTierData | undefined;
}

export const ShareRosterModal: React.FC<ShareRosterModalProps> = ({
  isOpen,
  onClose,
  roster,
  leagueProfile,
  projections,
  timeWindow,
  getTeamTier,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ShareFormat>('portrait-feed');
  const [isRendering, setIsRendering] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareFrameRef = useRef<HTMLDivElement | null>(null);
  const renderFrameRef = useRef<HTMLDivElement | null>(null);

  const currentFormat = FORMAT_OPTIONS.find(f => f.id === selectedFormat) || FORMAT_OPTIONS[0];

  // Check browser support
  const canCopyImage = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write;
  const canWebShare = navigator.share && navigator.canShare;

  // Render the image when modal opens or format changes
  useEffect(() => {
    if (!isOpen) {
      setImageBlob(null);
      setError(null);
      setCopySuccess(false);
      return;
    }

    const renderImage = async () => {
      try {
        setIsRendering(true);
        setError(null);

        // Small delay to ensure DOM is ready
        await new Promise((resolve) => setTimeout(resolve, 150));

        const node = renderFrameRef.current;
        if (!node) {
          throw new Error('Share frame not found');
        }

        const { width, height } = currentFormat.dimensions;

        // Capture the offscreen frame with current format dimensions
        const canvas = await html2canvas(node, {
          backgroundColor: '#0f172a',
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: width,
          windowHeight: height,
        });

        // Convert to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
        });

        if (!blob) {
          throw new Error('Failed to create image');
        }

        setImageBlob(blob);
      } catch (err) {
        console.error('Failed to render image:', err);
        setError('Failed to render image. Please try again.');
      } finally {
        setIsRendering(false);
      }
    };

    renderImage();
  }, [isOpen, selectedFormat, currentFormat.dimensions]);

  const handleDownload = () => {
    if (!imageBlob) return;

    try {
      const url = URL.createObjectURL(imageBlob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `cracked-ice-roster-${timestamp}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Download failed. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!imageBlob || !canCopyImage) return;

    try {
      const item = new ClipboardItem({ 'image/png': imageBlob });
      await navigator.clipboard.write([item]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Failed to copy to clipboard. Please try downloading instead.');
    }
  };

  const handleWebShare = async () => {
    if (!imageBlob || !canWebShare) return;

    try {
      const file = new File([imageBlob], 'cracked-ice-roster.png', { type: 'image/png' });
      const shareData = {
        files: [file],
        title: 'My Fantasy Hockey Roster',
        text: 'Check out my roster from Cracked Ice!',
      };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        setError('Sharing files is not supported on this browser.');
      }
    } catch (err: any) {
      // User cancelled the share - don't show error
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        setError('Share failed. Please try downloading instead.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Share Roster</h2>
            <p className="text-sm text-slate-400 mt-0.5">Export a social-ready image of your current roster</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-6 p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Left: Preview */}
          <div className="flex-1 min-w-0">
            <div
              className="relative w-full"
              style={{
                paddingBottom: `${(currentFormat.dimensions.height / currentFormat.dimensions.width) * 100}%`
              }}
            >
              <div className="absolute inset-0 bg-slate-950 rounded-xl border border-white/10 overflow-hidden">
                {isRendering ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Rendering preview...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center px-4">
                      <p className="text-sm text-red-400">{error}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={shareFrameRef}
                    className="w-full h-full flex items-center justify-center overflow-hidden"
                  >
                    <div
                      style={{
                        transform: `scale(${Math.min(1, 600 / currentFormat.dimensions.width)})`,
                        transformOrigin: 'center center',
                        width: `${currentFormat.dimensions.width}px`,
                        height: `${currentFormat.dimensions.height}px`,
                      }}
                    >
                      <RosterShareFrame
                        roster={roster}
                        leagueProfile={leagueProfile}
                        projections={projections}
                        timeWindow={timeWindow}
                        getTeamTier={getTeamTier}
                        format={selectedFormat}
                        width={currentFormat.dimensions.width}
                        height={currentFormat.dimensions.height}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Share Options */}
          <div className="lg:w-80 flex flex-col gap-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Choose Format</h3>
              <div className="space-y-2">
                {FORMAT_OPTIONS.map((formatOption) => (
                  <label
                    key={formatOption.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedFormat === formatOption.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={formatOption.id}
                      checked={selectedFormat === formatOption.id}
                      onChange={(e) => setSelectedFormat(e.target.value as ShareFormat)}
                      className="mt-0.5 w-4 h-4 text-cyan-500 border-slate-500 focus:ring-cyan-500 focus:ring-2"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{formatOption.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatOption.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {/* Download PNG */}
              <button
                onClick={handleDownload}
                disabled={isRendering || !imageBlob}
                className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>

              {/* Copy to Clipboard */}
              {canCopyImage && (
                <button
                  onClick={handleCopy}
                  disabled={isRendering || !imageBlob}
                  className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm relative"
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Image
                    </>
                  )}
                </button>
              )}

              {/* Web Share */}
              {canWebShare && (
                <button
                  onClick={handleWebShare}
                  disabled={isRendering || !imageBlob}
                  className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Share...
                </button>
              )}
            </div>

            {/* Info Box */}
            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-white/5">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wide mb-2">
                {currentFormat.aspectRatio} — Perfect For
              </h3>
              <ul className="text-xs text-slate-400 space-y-1">
                {currentFormat.platforms.map((platform, idx) => (
                  <li key={idx}>• {platform}</li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-white/10">
                <ul className="text-xs text-slate-400 space-y-1">
                  <li><strong className="text-slate-300">Download:</strong> Save as PNG file</li>
                  {canCopyImage && <li><strong className="text-slate-300">Copy:</strong> Paste in apps</li>}
                  {canWebShare && <li><strong className="text-slate-300">Share:</strong> Use share menu</li>}
                </ul>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors text-sm mt-auto"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Hidden render frame (offscreen) */}
        <div
          ref={renderFrameRef}
          className="fixed"
          style={{ left: '-9999px', top: '-9999px' }}
        >
          <RosterShareFrame
            roster={roster}
            leagueProfile={leagueProfile}
            projections={projections}
            timeWindow={timeWindow}
            getTeamTier={getTeamTier}
            format={selectedFormat}
            width={currentFormat.dimensions.width}
            height={currentFormat.dimensions.height}
          />
        </div>
      </div>
    </div>
  );
};
