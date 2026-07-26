import { describe, expect, it } from 'vitest';
import { FANTASY_TEAM_LOGO_MAX_BYTES, validateFantasyTeamLogo } from './fantasyTeamLogo';

describe('fantasy team logo validation', () => {
  it('accepts supported image formats within the upload limit', () => {
    expect(validateFantasyTeamLogo(new File(['logo'], 'logo.png', { type: 'image/png' }))).toBeNull();
    expect(validateFantasyTeamLogo(new File(['logo'], 'logo.webp', { type: 'image/webp' }))).toBeNull();
  });

  it('rejects unsafe formats and oversized images', () => {
    expect(validateFantasyTeamLogo(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))).toContain('PNG');
    expect(validateFantasyTeamLogo(new File([new Uint8Array(FANTASY_TEAM_LOGO_MAX_BYTES + 1)], 'huge.jpg', { type: 'image/jpeg' }))).toContain('5 MB');
  });
});
