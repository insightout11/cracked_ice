import { useState, useEffect } from 'react';
import { getWeights, type WeightsResponse } from '../lib/coachApi';
import type { LeagueProfile } from '../types';

interface WeightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  league?: LeagueProfile;
}

export function WeightsDrawer({ isOpen, onClose, league }: WeightsDrawerProps) {
  const [weights, setWeights] = useState<WeightsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setLoading(true);

    getWeights(league, controller.signal)
      .then((response) => {
        setWeights(response);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to load weights:', error);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, league]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        className='fixed top-[0] left-[0] right-[0] bottom-[0] bg-surface-0 z-[999]'
      />
      <div
        className='fixed top-[0] right-[0] bottom-[0] w-[400px] max-w-[90vw] bg-surface-1 [box-shadow:-4px_0_20px_var(--surface-0)] z-[1000] flex flex-col text-ink'
      >
        {/* Header */}
        <div
          className='p-[20px] [border-bottom:1px_solid_var(--line)] flex justify-between items-center'
        >
          <h2 className='m-[0] text-[18px] font-semibold'>
            Scoring Weights
          </h2>
          <button
            onClick={onClose}
            className='[background:none] [border:none] text-ink text-[24px] cursor-pointer p-[0] leading-[1]'
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className='[flex:1] overflow-y-auto p-[20px]'>
          {loading ? (
            <div className='text-center [padding:40px_0]'>
              <div className='text-ink'>
                Loading weights...
              </div>
            </div>
          ) : weights ? (
            <>
              {/* Source Badge */}
              <div
                className='inline-block [padding:4px_12px] bg-accent-muted [border:1px_solid_var(--accent-muted)] rounded-[12px] text-[12px] font-medium text-accent mb-[20px]'
              >
                Source: {weights.source}
              </div>

              {/* Warnings */}
              {weights.warnings && weights.warnings.length > 0 && (
                <div
                  className='p-[12px] bg-warning-muted [border:1px_solid_var(--warning-muted)] rounded-[6px] mb-[20px]'
                >
                  {weights.warnings.map((warning, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: index < weights.warnings!.length - 1 ? '4px' : 0
                      }}
                      className='text-[13px] text-warning'>
 {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Skater Weights */}
              <div className='mb-[24px]'>
                <h3
                  className='text-[14px] font-semibold text-ink mb-[12px] uppercase tracking-[0.5px]'
                >
                  Skater Scoring
                </h3>
                <div className='flex flex-col gap-[8px]'>
                  {Object.entries(weights.skater).map(([key, value]) => {
                    const numValue = value as number;
                    return (
                      <div
                        key={key}
                        className='flex justify-between [padding:8px_12px] bg-line rounded-[4px]'
                      >
                        <span
                          className='text-[14px] text-ink capitalize'
                        >
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span
                          style={{
                            color: numValue > 0 ? 'var(--positive)' : numValue < 0 ? 'var(--negative)' : 'var(--ink)'
                          }}
                          className='text-[14px] font-semibold'>
                          {numValue > 0 ? '+' : ''}{numValue}
                        </span>
                      </div>
                    );})}

                </div>
              </div>

              {/* Goalie Weights */}
              <div>
                <h3
                  className='text-[14px] font-semibold text-ink mb-[12px] uppercase tracking-[0.5px]'
                >
                  Goalie Scoring
                </h3>
                <div className='flex flex-col gap-[8px]'>
                  {Object.entries(weights.goalie).map(([key, value]) => {
                    const numValue = value as number;
                    return (
                      <div
                        key={key}
                        className='flex justify-between [padding:8px_12px] bg-line rounded-[4px]'
                      >
                        <span
                          className='text-[14px] text-ink capitalize'
                        >
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span
                          style={{
                            color: numValue > 0 ? 'var(--positive)' : numValue < 0 ? 'var(--negative)' : 'var(--ink)'
                          }}
                          className='text-[14px] font-semibold'>
                          {numValue > 0 ? '+' : ''}{numValue}
                        </span>
                      </div>
                    );})}

                </div>
              </div>
            </>
          ) : (
            <div className='text-center [padding:40px_0] text-ink'>
              No weights loaded
            </div>
          )}
        </div>
      </div>
    </>
  );
}
