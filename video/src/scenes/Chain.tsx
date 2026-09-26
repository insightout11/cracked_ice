import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONTENT, GRID, gridColumn, laneTop } from '../layout';
import { body, C, display, enter, logoUrl, TEAM_NAMES } from '../theme';
import type { WeekProps } from '../types';

const LEG_DELAY = 18;
const LEG_GAP = 42;
const DOT_GAP = 6;

const laneCount = (props: WeekProps) => props.chain.legs.length + (props.chain.bridge ? 1 : 0);

/** Where the packed night's column sits in the grid (Nights hands its bar over to this). */
export function saturdayColumn(props: WeekProps) {
  const packed = props.nights.find((night) => night.packed);
  const index = packed ? props.chain.dates.indexOf(packed.date) : -1;
  if (index < 0) return null;
  const column = gridColumn(index, props.chain.dates.length);
  const y = GRID.top + GRID.headerHeight - 12;
  return { x: column.x, width: column.width, y, height: laneTop(laneCount(props)) - GRID.rowGap - y + 12 };
}

function Lane({ index, team, dates, from, to, games, delay, dashed = false, caption }: { index: number; team: string; dates: string[]; from: string; to: string; games: string[]; delay: number; dashed?: boolean; caption: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  const top = laneTop(index);
  const first = gridColumn(dates.indexOf(from), dates.length);
  const last = gridColumn(dates.indexOf(to), dates.length);
  return (
    <div style={{ opacity: Math.min(1, t * 1.5) }}>
      <div style={{ position: 'absolute', left: CONTENT.left, top, width: GRID.label - 16, height: GRID.row, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Img src={logoUrl(team)} style={{ width: 76, height: 76 }} />
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 38, color: C.ink }}>{team}</span>
        </div>
        <span style={{ fontFamily: body, fontSize: 22, color: dashed ? C.ice : C.mute }}>{caption}</span>
      </div>
      <div style={{
        position: 'absolute', top: top + 12, height: GRID.row - 24, left: first.x,
        width: (last.x + last.width - first.x) * t, borderRadius: 22,
        background: dashed ? 'rgba(99,230,255,0.08)' : 'rgba(99,230,255,0.16)',
        border: `3px ${dashed ? 'dashed' : 'solid'} ${dashed ? C.mute : C.ice}`,
      }} />
      {games.map((date, dot) => {
        const pop = enter(frame, fps, delay + 12 + dot * DOT_GAP, { damping: 11 });
        const column = gridColumn(dates.indexOf(date), dates.length);
        return (
          <div key={date} style={{
            position: 'absolute', top: top + GRID.row / 2 - 22, left: column.x + column.width / 2 - 22, width: 44, height: 44, borderRadius: 22,
            background: C.ice, boxShadow: '0 0 24px rgba(99,230,255,0.6)', transform: `scale(${pop})`,
          }} />
        );
      })}
    </div>
  );
}

function Comparison({ label, value, max, delay, highlight }: { label: string; value: number; max: number; delay: number; highlight: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  return (
    <div style={{ marginTop: 22, opacity: Math.min(1, t * 2) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: body, fontWeight: 700, fontSize: 32, color: highlight ? C.ink : C.dim }}>
        <span>{label}</span>
        <span style={{ fontFamily: display, fontWeight: 800, color: highlight ? C.green : C.dim }}>{(value * t).toFixed(1)}</span>
      </div>
      <div style={{ marginTop: 10, height: 26, width: `${(value / max) * 100 * t}%`, borderRadius: 13, background: highlight ? C.green : C.line }} />
    </div>
  );
}

/** The featured stream as lanes across the week, a count of the games it plays, and what it beats. */
export function Chain({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { chain } = props;
  const title = enter(frame, fps, 0);
  const column = saturdayColumn(props);
  // Arrives as the red bar from the previous scene, then settles into a tint.
  const settle = interpolate(frame, [0, 14], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dayOf = (date: string) => chain.labels[chain.dates.indexOf(date)]?.replace('Next ', '') ?? '';
  const legCaption = (games: string[]) => `${dayOf(games[0])}–${dayOf(games[games.length - 1])}`;

  // Games the stream plays, counted as each dot lands.
  const dotFrames = chain.legs.flatMap((leg, index) => leg.games.map((_, dot) => LEG_DELAY + index * LEG_GAP + 12 + dot * DOT_GAP));
  const played = dotFrames.filter((at) => frame >= at + 3).length;
  const lanesDone = LEG_DELAY + chain.legs.length * LEG_GAP + 20;
  const bridgeDelay = lanesDone + 70;
  const packedIndex = column ? chain.dates.findIndex((date) => props.nights.find((night) => night.packed)?.date === date) : -1;
  // The packed night flinches as the second leg runs across it.
  const flinch = Math.sin(Math.max(0, frame - (LEG_DELAY + LEG_GAP + 10)) * 1.6) * interpolate(frame, [LEG_DELAY + LEG_GAP + 10, LEG_DELAY + LEG_GAP + 26], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const holdOne = chain.holdOne;
  const max = Math.max(chain.usable ?? 0, holdOne?.usable ?? 0);

  return (
    <>
      <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 250, opacity: title }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 76, lineHeight: 1.02, color: C.ink }}>
          {chain.legs.length} adds. <span style={{ color: C.ice }}>{chain.title}.</span>
        </div>
      </div>

      {column && (
        <div style={{ position: 'absolute', left: column.x, top: column.y, width: column.width, height: column.height, borderRadius: 16, background: `rgba(255,125,139,${0.10 + 0.8 * settle})` }} />
      )}
      {chain.dates.map((date, index) => {
        const col = gridColumn(index, chain.dates.length);
        const next = chain.labels[index].startsWith('Next');
        return (
          <div key={date} style={{ position: 'absolute', left: col.x, width: col.width, top: GRID.top, textAlign: 'center', fontFamily: body, fontWeight: 700, fontSize: 30, opacity: title, color: index === packedIndex ? C.red : next ? C.mute : C.ink, transform: index === packedIndex ? `translateX(${flinch}px)` : undefined }}>
            {chain.labels[index].replace('Next ', '')}
            {next && <div style={{ fontSize: 18, fontWeight: 600 }}>next wk</div>}
          </div>
        );
      })}

      {chain.legs.map((leg, index) => (
        <Lane key={leg.team} index={index} team={leg.team} dates={chain.dates} from={leg.from} to={leg.to} games={leg.games} delay={LEG_DELAY + index * LEG_GAP} caption={legCaption(leg.games)} />
      ))}
      {chain.bridge && (
        <Lane index={chain.legs.length} team={chain.bridge.team} dates={chain.dates} from={chain.bridge.games[0]} to={chain.bridge.games[chain.bridge.games.length - 1]} games={chain.bridge.games} delay={bridgeDelay} dashed caption="Optional 3rd add" />
      )}

      <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: laneTop(laneCount(props)) + 20 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 56, color: C.ink, opacity: played > 0 ? 1 : 0 }}>
          <span style={{ color: C.ice }}>{played}</span> games from one roster spot
        </div>
        {holdOne && chain.usable !== null && (
          <>
            <Comparison label={`Hold one ${TEAM_NAMES[holdOne.team]?.replace(/s$/, '') ?? holdOne.team}`} value={holdOne.usable} max={max} delay={lanesDone} highlight={false} />
            <Comparison label={`${chain.legs.map((leg) => TEAM_NAMES[leg.team] ?? leg.team).join(' → ')}`} value={chain.usable} max={max} delay={lanesDone + 14} highlight />
            <div style={{ marginTop: 14, fontFamily: body, fontSize: 26, color: C.mute, opacity: enter(frame, fps, lanesDone + 26) }}>games that fit a lineup, from 1,800 simulated rosters</div>
          </>
        )}
      </div>
    </>
  );
}
