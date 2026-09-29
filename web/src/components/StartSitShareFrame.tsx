import React from 'react';
import type { RosterPlayer } from '../lib/coachSchemas';
import type { StartSitContender, StartSitGroup } from '../lib/startSit';
import { getTeamColor } from '../lib/teamLogos';
import { CARD, CardBackdrop, Headshot, SvgText, gameTimeEt, lastName } from './shareFrameParts';

const WIDTH = 1080;
const PAD = 54;
const INNER = WIDTH - PAD * 2;
const LETTER_COLUMN = 104;
const VALUE_COLUMN = 170;

const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

function Ballot({ contender, height, showPick }: { contender: StartSitContender; height: number; showPick: boolean }) {
  const { player, game } = contender;
  const photo = Math.min(96, height - 36);
  const flagged = showPick && contender.suggestedSit;
  const textWidth = INNER - 8 - LETTER_COLUMN - 24 - photo - 24 - VALUE_COLUMN - 24;
  const time = gameTimeEt(game.startTime);
  const matchup = `${player.positions.join('/')}  ·  ${game.isHome ? 'vs' : '@'} ${game.opponent}${time ? `  ·  ${time}` : ''}`;
  return (
    <article className={`relative flex items-center overflow-hidden rounded-2xl border bg-surface-1 ${flagged ? 'border-warning' : 'border-line'}`} style={{ height }}>
      <span className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className="flex h-full shrink-0 items-center justify-center border-r border-line" style={{ width: LETTER_COLUMN, marginLeft: 8 }}>
        <SvgText text={contender.letter} width={LETTER_COLUMN} size={64} weight={900} color={CARD.accent} anchor="middle" />
      </div>
      <div className="ml-6"><Headshot player={player} size={photo} /></div>
      <div className="ml-6 flex flex-col gap-2" style={{ width: textWidth }}>
        <SvgText text={player.full_name} width={textWidth} size={34} weight={800} />
        <SvgText
          width={textWidth}
          size={22}
          weight={600}
          color={CARD.dim}
          spans={[{ text: matchup }, ...(game.isOffNight ? [{ text: '  ·  OFF-NIGHT', color: CARD.positive, weight: 800 }] : [])]}
        />
      </div>
      <div className="ml-auto mr-6 flex flex-col items-end gap-1" style={{ width: VALUE_COLUMN }}>
        {flagged && <SvgText text="OUR PICK: SIT" width={VALUE_COLUMN} size={15} weight={900} color={CARD.warning} anchor="end" letterSpacing={1} />}
        <SvgText text={contender.fppg.toFixed(2)} width={VALUE_COLUMN} size={44} weight={800} anchor="end" />
        <SvgText text="pts per game" width={VALUE_COLUMN} size={17} weight={600} color={CARD.mute} anchor="end" />
      </div>
    </article>
  );
}

/**
 * The start/sit question for one busy night, as a square image for chats: the players
 * in the running, lettered so replies can be one letter, and who's already locked in.
 * Text is SVG so html2canvas draws it where it belongs.
 */
export const StartSitShareFrame: React.FC<{ group: StartSitGroup | null; locked: RosterPlayer[]; date: string; showPick: boolean; teamName: string }> = ({ group, locked, date, showPick, teamName }) => {
  const contenders = group?.contenders ?? [];
  const rowHeight = contenders.length <= 2 ? 190 : contenders.length === 3 ? 160 : 136;
  const question = !group ? 'NO BENCH DECISION' : group.sits === 1 ? 'WHO SITS?' : `WHICH ${group.sits} SIT?`;
  const letters = contenders.map((contender) => contender.letter);
  const replyHint = letters.length > 1 ? `Reply ${letters.slice(0, -1).join(', ')} or ${letters[letters.length - 1]}` : '';
  const subtitle = group ? `${contenders.length} players, ${group.sits} ${group.sits === 1 ? 'sits' : 'sit'}  ·  ${group.label[0].toUpperCase()}${group.label.slice(1)}${teamName ? `  ·  ${teamName}` : ''}` : 'Everyone playing this night fits in the lineup.';

  return (
    <div className="relative flex h-[1080px] w-[1080px] flex-col overflow-hidden bg-surface-0 text-ink">
      <CardBackdrop />
      <header className="relative flex items-start justify-between pt-12" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-9 w-auto opacity-90" />
        <div className="flex flex-col items-end gap-1">
          <SvgText text="START / SIT" width={260} size={18} weight={800} color={CARD.accent} anchor="end" letterSpacing={2} />
          <SvgText text={longDate(date)} width={360} size={20} weight={500} color={CARD.dim} anchor="end" />
        </div>
      </header>

      <section className="relative mt-8 flex flex-col gap-3" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <SvgText text={question} width={INNER} size={92} weight={900} />
        <SvgText text={subtitle} width={INNER} size={26} weight={500} color={CARD.dim} />
      </section>

      <main className="relative flex flex-1 flex-col justify-center gap-4" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        {contenders.map((contender) => <Ballot key={contender.player.id} contender={contender} height={rowHeight} showPick={showPick} />)}
      </main>

      {group && locked.length > 0 && (
        <div className="relative" style={{ paddingLeft: PAD, paddingRight: PAD }}>
          <SvgText text={`Already starting: ${locked.map(lastName).join(', ')}`} width={INNER} size={19} weight={500} color={CARD.mute} />
        </div>
      )}

      <footer className="relative mb-10 mt-5 flex items-center justify-between border-t border-line pt-6" style={{ marginLeft: PAD, marginRight: PAD }}>
        <SvgText text={replyHint} width={560} size={28} weight={800} />
        <SvgText text="crackedicehockey.com" width={320} size={18} weight={500} color={CARD.mute} anchor="end" />
      </footer>
    </div>
  );
};
