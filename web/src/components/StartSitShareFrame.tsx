import React from 'react';
import type { RosterPlayer } from '../lib/coachSchemas';
import type { StartSitContender, StartSitGroup } from '../lib/startSit';
import { mugshotSeason } from '../lib/season';
import { getTeamColor } from '../lib/teamLogos';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatTime(startTime?: string): string {
  if (!startTime || !startTime.includes('T')) return '';
  return new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** SVG text so long names shrink to fit instead of wrapping in the rendered image. */
function FittedText({ text, width, size, weight = 800, className = 'text-ink' }: { text: string; width: number; size: number; weight?: number; className?: string }) {
  const estimated = text.length * size * 0.58;
  const fitted = estimated > width ? width : undefined;
  return (
    <svg viewBox={`0 0 ${width} ${Math.round(size * 1.4)}`} preserveAspectRatio="xMinYMid meet" className={`block w-full ${className}`} style={{ height: Math.round(size * 1.4) }} aria-label={text}>
      <text x="0" y={Math.round(size * 1.05)} fill="currentColor" fontFamily="Arial, sans-serif" fontSize={size} fontWeight={weight} textLength={fitted} lengthAdjust={fitted ? 'spacingAndGlyphs' : undefined}>{text}</text>
    </svg>
  );
}

function Ballot({ contender, height, showPick }: { contender: StartSitContender; height: number; showPick: boolean }) {
  const { player, game } = contender;
  const id = player.id.replace(/^nhl:/, '');
  const photo = height >= 150 ? 104 : 84;
  const time = formatTime(game.startTime);
  const flagged = showPick && contender.suggestedSit;
  return (
    <article className={`relative flex items-center overflow-hidden rounded-2xl border bg-surface-1 ${flagged ? 'border-warning' : 'border-line'}`} style={{ height }}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className="grid h-full w-[112px] shrink-0 place-items-center border-r border-line">
        <span className="font-mono text-[64px] font-black leading-none text-accent">{contender.letter}</span>
      </div>
      <div className="relative ml-6 shrink-0" style={{ width: photo, height: photo }}>
        <img src={`/api/coach/share-assets/headshot/${mugshotSeason}/${player.team}/${id}`} alt="" crossOrigin="anonymous" className="size-full rounded-full border border-line bg-surface-0 object-cover" />
        <img src={`/api/coach/share-assets/logo/${player.team}`} alt="" crossOrigin="anonymous" className="absolute -bottom-1 -right-1 size-8 object-contain" />
      </div>
      <div className="ml-6 min-w-0 flex-1 pr-8">
        <FittedText text={player.full_name} width={560} size={34} />
        <div className="mt-2 flex items-center gap-3 text-[22px] text-ink-dim">
          <span className="font-bold text-ink">{player.positions.join('/')}</span>
          <span>·</span>
          <span>{game.isHome ? 'vs' : '@'}</span>
          <img src={`/api/coach/share-assets/logo/${game.opponent}`} alt="" crossOrigin="anonymous" className="size-8 object-contain" />
          <span className="font-bold text-ink">{game.opponent}</span>
          {time && <span>· {time}</span>}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[20px]">
          <span><strong className="font-mono text-ink">{contender.fppg.toFixed(2)}</strong> <span className="text-ink-dim">pts/game</span></span>
          <span className="text-ink-dim"><strong className="font-mono text-ink">{contender.weekGames}</strong> game{contender.weekGames === 1 ? '' : 's'} this week</span>
          {game.isOffNight && <span className="rounded-full border border-positive/60 px-3 py-0.5 text-[15px] font-bold text-positive">OFF-NIGHT</span>}
        </div>
      </div>
      {flagged && <span className="absolute right-6 top-5 rounded-full bg-warning px-3 py-1 text-[14px] font-black text-surface-0">OUR PICK: SIT</span>}
    </article>
  );
}

/**
 * The start/sit question for one busy night, as a square image for chats: the players
 * in the running, lettered so replies can be one letter, and who's already locked in.
 */
export const StartSitShareFrame: React.FC<{ group: StartSitGroup | null; locked: RosterPlayer[]; date: string; showPick: boolean; teamName: string }> = ({ group, locked, date, showPick, teamName }) => {
  const decision = group;
  const contenders = group?.contenders ?? [];
  const rowHeight = contenders.length <= 2 ? 190 : contenders.length === 3 ? 158 : 128;
  const question = !decision ? 'No bench decision' : decision.sits === 1 ? 'Who sits?' : `Which ${decision.sits} sit?`;
  const letters = contenders.map((contender) => contender.letter);
  const replyHint = letters.length > 1 ? `Reply ${letters.slice(0, -1).join(', ')} or ${letters[letters.length - 1]}` : '';

  return (
    <div className="relative flex h-[1080px] w-[1080px] flex-col overflow-hidden bg-surface-0 font-sans text-ink">
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0" />
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.06]" />

      <header className="relative flex items-center justify-between px-14 pt-12">
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-9 w-auto opacity-90" />
        <div className="text-right">
          <p className="scoreboard-text text-base text-accent">START / SIT</p>
          <p className="mt-1 font-mono text-lg text-ink-dim">{formatDate(date)}</p>
        </div>
      </header>

      <section className="relative px-14 pt-10">
        <h1 className="text-[88px] font-black uppercase leading-none tracking-tight text-ink">{question}</h1>
        {decision && (
          <p className="mt-4 text-[26px] text-ink-dim">
            {contenders.length} players, {decision.sits} {decision.sits === 1 ? 'sits' : 'sit'} · <span className="capitalize">{decision.label}</span>{teamName ? ` · ${teamName}` : ''}
          </p>
        )}
      </section>

      <main className="relative flex flex-1 flex-col justify-center gap-4 px-14">
        {decision
          ? contenders.map((contender) => <Ballot key={contender.player.id} contender={contender} height={rowHeight} showPick={showPick} />)
          : <p className="text-[30px] text-ink-dim">Everyone playing this night fits in the lineup. Pick another date.</p>}
      </main>

      {decision && locked.length > 0 && (
        <p className="relative mx-14 truncate text-[19px] text-ink-mute">
          Already starting: {locked.map((player) => player.full_name.split(' ').slice(-1)[0]).join(', ')}
        </p>
      )}

      <footer className="relative mx-14 mb-10 mt-5 flex items-center justify-between border-t border-line pt-6">
        <p className="text-[26px] font-black text-ink">{replyHint}</p>
        <p className="font-mono text-[17px] text-ink-mute">crackedicehockey.com</p>
      </footer>
    </div>
  );
};
