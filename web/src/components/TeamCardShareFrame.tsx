import React from 'react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { getPlayerProjection, offNightStarts, startedPoints } from '../lib/playerProjection';
import { SEASON_LABEL } from '../lib/season';
import { CARD, Headshot, SvgText, lastName } from './shareFrameParts';
import { DEFAULT_JERSEY, darken, luminance, type JerseyColors } from '../lib/jerseyColors';

const WIDTH = 1200;
const HEIGHT = 675;
const JERSEY = 400;
const RIGHT = WIDTH - 48 - JERSEY - 56 - 56;

/** The team's initials for the jersey crest when there's no logo. */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 3).map((word) => word[0]) : [words[0]?.slice(0, 2) ?? 'CI']).join('').toUpperCase();
}

/** A hockey sweater in the team's colours, striped sleeves and hem, the crest on the chest. */
function Jersey({ crest, logo, colors }: { crest: string; logo: string | null; colors: JerseyColors }) {
  // The second stripe contrasts with the body: white on dark sweaters, near-black on light ones.
  const trim = luminance(colors.body) > 0.45 ? '#141414' : '#f3fbff';
  const body = 'M122 28 L162 14 Q200 46 238 14 L278 28 L372 84 L398 224 L330 240 L318 170 L318 430 L82 430 L82 170 L70 240 L2 224 L28 84 Z';
  return (
    <div className="relative" style={{ width: JERSEY, height: 440 }}>
      <svg width={JERSEY} height={440} viewBox="0 0 400 440" className="absolute inset-0">
        <defs>
          <linearGradient id="jersey-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.body} />
            <stop offset="1" stopColor={darken(colors.body, 0.38)} />
          </linearGradient>
          <clipPath id="jersey-clip"><path d={body} /></clipPath>
        </defs>
        <path d={body} fill="url(#jersey-fill)" stroke={colors.stripe} strokeOpacity="0.55" strokeWidth="3" />
        <g clipPath="url(#jersey-clip)">
          {/* Sleeve stripes and the hem stripe, sweater style. */}
          <path d="M0 176 L90 150 L90 168 L0 194 Z M400 176 L310 150 L310 168 L400 194 Z" fill={colors.stripe} />
          <path d="M0 200 L90 174 L90 182 L0 208 Z M400 200 L310 174 L310 182 L400 208 Z" fill={trim} opacity="0.8" />
          <rect x="0" y="378" width="400" height="18" fill={colors.stripe} />
          <rect x="0" y="402" width="400" height="7" fill={trim} opacity="0.8" />
        </g>
        {/* Collar. */}
        <path d="M162 14 Q200 46 238 14 Q222 58 200 62 Q178 58 162 14 Z" fill={colors.stripe} opacity="0.95" />
      </svg>
      <div className="absolute grid place-items-center overflow-hidden rounded-full" style={{ left: 110, top: 118, width: 180, height: 180, background: 'rgba(7, 17, 29, 0.6)', border: `3px solid ${colors.stripe}` }}>
        {logo
          ? <img src={logo} alt="" className="object-contain" style={{ width: 150, height: 150 }} />
          : <SvgText text={crest} width={160} size={crest.length > 2 ? 64 : 84} weight={900} color={CARD.ink} anchor="middle" />}
      </div>
    </div>
  );
}

function TopPlayer({ player, fppg, width }: { player: RosterPlayer; fppg: number; width: number }) {
  return (
    <div className="flex items-center gap-3" style={{ width }}>
      <Headshot player={player} size={64} />
      <div className="flex flex-col gap-1">
        <SvgText text={lastName(player)} width={width - 80} size={21} weight={800} />
        <SvgText spans={[{ text: `${player.positions.join('/')} · ` }, { text: fppg.toFixed(2), color: CARD.ink, weight: 800 }, { text: ' pts/g' }]} width={width - 80} size={15} weight={600} color={CARD.dim} />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <SvgText text={value} width={170} size={34} weight={800} />
      <SvgText text={label} width={170} size={15} weight={500} color={CARD.dim} />
    </div>
  );
}

/**
 * A landscape hockey card for the team: a sweater with the team's logo (or initials),
 * the name, and the top six by points per game. Sized for link-preview posts.
 */
export const TeamCardShareFrame: React.FC<{ roster: RosterPlayer[]; leagueProfile: LeagueProfile; projections: Record<string, PlayerProjection>; fantasyTeam: LeagueWorkspace['fantasyTeam'] }> = ({ roster, leagueProfile, projections, fantasyTeam }) => {
  const name = fantasyTeam.name.trim() || leagueProfile.league_name;
  const fppgOf = (player: RosterPlayer) => getPlayerProjection(projections, player.id)?.fppg ?? player.seasonFppg ?? player.blendedFppg ?? 0;
  const topSix = [...roster].sort((a, b) => fppgOf(b) - fppgOf(a)).slice(0, 6);
  const values = roster.map((player) => getPlayerProjection(projections, player.id)).filter((projection): projection is PlayerProjection => Boolean(projection));
  const hasSchedule = values.length > 0;
  const points = values.reduce((total, projection) => total + startedPoints(projection), 0);
  const starts = values.reduce((total, projection) => total + projection.starts, 0);
  const offNights = Math.round(values.reduce((total, projection) => total + offNightStarts(projection), 0));
  const column = Math.floor((RIGHT - 24) / 2);
  const colors: JerseyColors = fantasyTeam.jersey?.body && fantasyTeam.jersey.stripe ? { body: fantasyTeam.jersey.body, stripe: fantasyTeam.jersey.stripe } : DEFAULT_JERSEY;

  return (
    <div className="relative overflow-hidden bg-surface-0 text-ink" style={{ width: WIDTH, height: HEIGHT }}>
      {/* Foil edge and inset panel, trading-card style. */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${colors.stripe}, ${darken(colors.stripe, 0.55)} 35%, #0d1b29 55%, ${colors.body} 100%)` }} />
      <div className="absolute overflow-hidden rounded-[26px]" style={{ inset: 14, background: 'linear-gradient(135deg, #0b1826 0%, #0d1b29 45%, #102436 100%)' }}>
        <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.07]" />
        <div className="absolute" style={{ left: -120, top: -80, width: 620, height: 820, background: 'radial-gradient(circle at 50% 45%, rgba(99, 230, 255, 0.18), rgba(99, 230, 255, 0) 60%)' }} />
      </div>

      <div className="relative flex h-full items-center" style={{ paddingLeft: 48 }}>
        <Jersey crest={initials(name)} logo={fantasyTeam.logoDataUrl} colors={colors} />

        <div className="flex h-full flex-col justify-center" style={{ marginLeft: 56, width: RIGHT }}>
          <SvgText text={`${SEASON_LABEL} · TEAM CARD`} width={RIGHT} size={16} weight={800} color={CARD.accent} letterSpacing={2} />
          <div className="mt-2"><SvgText text={name} width={RIGHT} size={56} weight={900} /></div>
          <SvgText text={`${name === leagueProfile.league_name ? '' : `${leagueProfile.league_name} · `}${roster.length} players`} width={RIGHT} size={19} weight={500} color={CARD.dim} />

          <div className="mt-6 mb-3 flex items-center gap-3">
            <SvgText text="TOP SIX" width={110} size={14} weight={800} color={CARD.accent} letterSpacing={1.5} />
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {topSix.map((player) => <TopPlayer key={player.id} player={player} fppg={fppgOf(player)} width={column} />)}
          </div>

          {hasSchedule && (
            <div className="mt-6 flex gap-8 border-t border-line pt-4">
              <Stat value={points.toFixed(0)} label="projected points" />
              <Stat value={String(starts)} label="lineup starts" />
              <Stat value={String(offNights)} label="off-night starts" />
            </div>
          )}
        </div>
      </div>

      <div className="absolute" style={{ right: 40, bottom: 30 }}>
        <SvgText text="crackedicehockey.com" width={240} size={15} weight={500} color={CARD.mute} anchor="end" />
      </div>
    </div>
  );
};
