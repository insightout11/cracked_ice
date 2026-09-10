import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('navigation stacking', () => {
  it('keeps global navigation above page content', () => {
    const header = readFileSync(`${process.cwd()}/src/components/Header.tsx`, 'utf8');
    const mobile = readFileSync(`${process.cwd()}/src/components/MobileMenu.tsx`, 'utf8');
    expect(header).toContain('z-[2000]');
    expect(mobile).toContain('z-[3000]');
  });
});
