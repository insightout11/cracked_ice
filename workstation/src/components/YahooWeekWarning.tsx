import React, { useState } from 'react';
import { YAHOO_WEEK_EXPLANATION, COMMON_CONVERSIONS } from '../lib/yahooWeekConversion';

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
      <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 font-medium">
              Yahoo Week Numbers Different
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Due to Olympics break, Yahoo weeks are ~3 lower.
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1 underline hover:no-underline font-medium"
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
            </p>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <div className="text-xs text-amber-700 space-y-2">
                  <p><strong>Common conversions:</strong></p>
                  {COMMON_CONVERSIONS.map((conv, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-amber-100 rounded px-2 py-1">
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
              className="flex-shrink-0 text-amber-600 hover:text-amber-800 ml-2"
              aria-label="Dismiss warning"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800 mb-2">
            {YAHOO_WEEK_EXPLANATION.title}
          </h4>
          <p className="text-sm text-amber-700 mb-3">
            {YAHOO_WEEK_EXPLANATION.description}
          </p>

          <div className="space-y-2">
            <div className="bg-amber-100 rounded-md p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">Quick Reference:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {COMMON_CONVERSIONS.map((conversion, index) => (
                  <div key={index} className="flex flex-col items-center text-center">
                    <div className="font-medium text-amber-900">{conversion.label}</div>
                    <div className="text-amber-700 mt-1">
                      <div>Site: {conversion.site.join('-')}</div>
                      <div>Yahoo: {conversion.yahoo.join('-')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-100 border border-green-200 rounded-md p-2">
              <p className="text-xs text-green-800">
                <strong>💡 Tip:</strong> {YAHOO_WEEK_EXPLANATION.tip}
              </p>
            </div>
          </div>

          <p className="text-xs text-amber-600 mt-3 font-medium">
            Example: {YAHOO_WEEK_EXPLANATION.example}
          </p>
        </div>

        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
            aria-label="Dismiss warning"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default YahooWeekWarning;