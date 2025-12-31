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
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '400px',
          maxWidth: '90vw',
          backgroundColor: '#1a1a2e',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          color: 'rgba(255, 255, 255, 0.9)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Scoring Weights
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Loading weights...
              </div>
            </div>
          ) : weights ? (
            <>
              {/* Source Badge */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#60a5fa',
                  marginBottom: '20px',
                }}
              >
                Source: {weights.source}
              </div>

              {/* Warnings */}
              {weights.warnings && weights.warnings.length > 0 && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '6px',
                    marginBottom: '20px',
                  }}
                >
                  {weights.warnings.map((warning, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: '13px',
                        color: '#fbbf24',
                        marginBottom: index < weights.warnings!.length - 1 ? '4px' : 0,
                      }}
                    >
                      ⚠ {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Skater Weights */}
              <div style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Skater Scoring
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(weights.skater).map(([key, value]) => {
                    const numValue = value as number;
                    return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: numValue > 0 ? '#10b981' : numValue < 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        {numValue > 0 ? '+' : ''}{numValue}
                      </span>
                    </div>
                  )})}

                </div>
              </div>

              {/* Goalie Weights */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Goalie Scoring
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(weights.goalie).map(([key, value]) => {
                    const numValue = value as number;
                    return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: numValue > 0 ? '#10b981' : numValue < 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        {numValue > 0 ? '+' : ''}{numValue}
                      </span>
                    </div>
                  )})}

                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255, 255, 255, 0.6)' }}>
              No weights loaded
            </div>
          )}
        </div>
      </div>
    </>
  );
}
