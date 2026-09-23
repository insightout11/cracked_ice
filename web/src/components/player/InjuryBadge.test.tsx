import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InjuryBadge } from './InjuryBadge';

// Radix renders tooltip content only when open; expose the label so it can be asserted.
vi.mock('../ui/tooltip', () => ({
  TooltipLabel: ({ children, label }: { children: ReactNode; label: ReactNode }) => (
    <span data-tooltip={String(label)}>{children}</span>
  ),
}));

describe('InjuryBadge', () => {
  it('renders nothing for active players or missing status', () => {
    expect(renderToStaticMarkup(<InjuryBadge injuryStatus="O" isActive />)).toBe('');
    expect(renderToStaticMarkup(<InjuryBadge />)).toBe('');
  });

  it('shows the full Yahoo label and note, with the note in the tooltip', () => {
    const html = renderToStaticMarkup(<InjuryBadge injuryStatus="O" injuryNote="Lower Body" />);
    expect(html).toContain('data-tooltip="Out: Lower Body"');
    expect(html).toContain('>Out<');
    expect(html).toContain('(Lower Body)');
  });

  it('keeps a descriptive tooltip when Yahoo has no injury note', () => {
    const html = renderToStaticMarkup(<InjuryBadge injuryStatus="IR-LT" />);
    expect(html).toContain('data-tooltip="Injured Reserve (long-term)"');
  });

  it('uses the short code without the inline note in compact rows', () => {
    const html = renderToStaticMarkup(<InjuryBadge injuryStatus="DTD" injuryNote="Upper Body" size="sm" />);
    expect(html).toContain('>DTD<');
    expect(html).not.toContain('(Upper Body)');
    expect(html).toContain('data-tooltip="Day-to-day: Upper Body"');
  });

  it('falls back to Yahoo status_full for codes without a local label', () => {
    const html = renderToStaticMarkup(<InjuryBadge injuryStatus="SUSP" injuryStatusFull="Suspended" />);
    expect(html).toContain('>Suspended<');
  });
});
