import React, { useState } from 'react';
import { YAHOO_WEEK_EXPLANATION, COMMON_CONVERSIONS } from '../lib/yahooWeekConversion';
import { Info, X } from 'lucide-react';

interface YahooWeekWarningProps {
  className?: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
  compact?: boolean;
}

export const YahooWeekWarning: React.FC<YahooWeekWarningProps> = ({
  className = '',
  onDismiss,
  showDismiss = true,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact) {
    return (
      <div className={`bg-warning-muted border border-warning rounded-lg p-3 ${className}`}>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4 text-warning" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-warning font-medium">
              Yahoo Week Numbers Different
            </p>
            <p className="text-xs text-warning mt-1">
              Due to Olympics break, Yahoo weeks are ~3 lower.
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1 underline hover:no-underline font-medium"
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
            </p>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-warning">
                <div className="text-xs text-warning space-y-2">
                  <p><strong>Common conversions:</strong></p>
                  {COMMON_CONVERSIONS.map((conv, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-warning-muted rounded px-2 py-1">
                      <span>Site: {conv.site.join('-')}</span>
                      <span>→</span>
                      <span>Yahoo: {conv.yahoo.join('-')}</span>
                    </div>
                  ))}
                  <p className="italic mt-2">{YAHOO_WEEK_EXPLANATION.tip}</p>
                </div>
              </div>
            )}
          </div>

          {showDismiss && onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-warning hover:text-warning ml-2"
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-warning-muted border border-warning rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Info className="w-6 h-6 text-warning" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-warning mb-2">
            {YAHOO_WEEK_EXPLANATION.title}
          </h4>
          <p className="text-sm text-warning mb-3">
            {YAHOO_WEEK_EXPLANATION.description}
          </p>

          <div className="space-y-2">
            <div className="bg-warning-muted rounded-md p-3">
              <p className="text-sm font-medium text-warning mb-2">Quick Reference:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {COMMON_CONVERSIONS.map((conversion, index) => (
                  <div key={index} className="flex flex-col items-center text-center">
                    <div className="font-medium text-warning">{conversion.label}</div>
                    <div className="text-warning mt-1">
                      <div>Site: {conversion.site.join('-')}</div>
                      <div>Yahoo: {conversion.yahoo.join('-')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-positive-muted border border-positive rounded-md p-2">
              <p className="text-xs text-positive">
 <strong> Tip:</strong> {YAHOO_WEEK_EXPLANATION.tip}
              </p>
            </div>
          </div>

          <p className="text-xs text-warning mt-3 font-medium">
            Example: {YAHOO_WEEK_EXPLANATION.example}
          </p>
        </div>

        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-warning hover:text-warning transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default YahooWeekWarning;
