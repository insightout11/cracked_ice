import { Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, enter, logoUrl, TEAM_NAMES } from '../theme';
import type { WeekProps } from '../types';

const LABEL = 190;
const ROW = 150;

function Lane({ team, dates, from, to, games, delay, dashed = false, caption }: { team: string; dates: string[]; from: string; to: string; games: string[]; delay: number; dashed?: boolean; caption: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  const first = dates.indexOf(from);
  const last = dates.indexOf(to);
  const col = `calc((100% - ${LABEL}px) / ${dates.length})`;
  return (
    <div style={{ position: 'relative', height: ROW, marginTop: 18, opacity: Math.min(1, t * 1.5) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: LABEL - 16, height: ROW, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Img src={logoUrl(team)} style={{ width: 76, height: 76 }} />
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 38, color: C.ink }}>{team}</span>
        </div>
        <span style={{ fontFamily: body, fontSize: 22, color: C.mute }}>{caption}</span>
      </div>
      {/* The leg: grows from its first night to its last. */}
      <div style={{
        position: 'absolute', top: 12, height: ROW - 24,
        left: `calc(${LABEL}px + ${col} * ${first})`,
        width: `calc(${col} * ${(last - first + 1) * t})`,
        borderRadius: 22,
        background: dashed ? 'rgba(99,230,255,0.08)' : 'rgba(99,230,255,0.16)',
        border: `3px ${dashed ? 'dashed' : 'solid'} ${dashed ? C.mute : C.ice}`,
      }} />
      {games.map((date, index) => {
        const pop = enter(frame, fps, delay + 12 + index * 6, { damping: 11 });
        return (
          <div key={date} style={{
            position: 'absolute', top: ROW / 2 - 22, width: 44, height: 44, borderRadius: 22,
            left: `calc(${LABEL}px + ${col} * ${dates.indexOf(date) + 0.5} - 22px)`,
            background: C.ice, boxShadow: '0 0 24px rgba(99,230,255,0.6)', transform: `scale(${pop})`,
          }} />
        );
      })}
    </div>
  );
}

/** The featured two-add stream as lanes across the week, plus the optional bridge add. */
export function Chain({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { chain } = props;
  const packedDates = new Set(props.nights.filter((night) => night.packed).map((night) => night.date));
  const title = enter(frame, fps, 0);
  const result = enter(frame, fps, 215);
  const dayOf = (date: string) => chain.labels[chain.dates.indexOf(date)]?.replace('Next ', '') ?? '';
  const legCaption = (leg: { from: string; to: string; games: string[] }) => `${dayOf(leg.games[0])}–${dayOf(leg.games[leg.games.length - 1])}`;
  const col = `calc((100% - ${LABEL}px) / ${chain.dates.length})`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 68, lineHeight: 1.05, color: C.ink }}>{chain.title}</div>
        <div style={{ marginTop: 16, fontFamily: body, fontSize: 32, color: C.dim }}>
          {chain.legs.length} adds, one roster spot: {chain.legs.map((leg) => `${TEAM_NAMES[leg.team] ?? leg.team} ${legCaption(leg)}`).join(', then ')}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 90 }}>
        {/* Night columns; the packed night is shaded. */}
        <div style={{ position: 'relative', height: 70, opacity: title }}>
          {chain.dates.map((date, index) => (
            <div key={date} style={{ position: 'absolute', left: `calc(${LABEL}px + ${col} * ${index})`, width: col, textAlign: 'center', fontFamily: body, fontWeight: 700, fontSize: 28, color: packedDates.has(date) ? C.red : date > props.nights[props.nights.length - 1].date ? C.mute : C.ink }}>
              {chain.labels[index].replace('Next ', '')}
              {chain.labels[index].startsWith('Next') && <div style={{ fontSize: 18, fontWeight: 600, color: C.mute }}>next week</div>}
            </div>
          ))}
        </div>
        {[...packedDates].map((date) => (
          <div key={date} style={{ position: 'absolute', top: 60, bottom: -10, left: `calc(${LABEL}px + ${col} * ${chain.dates.indexOf(date)})`, width: col, borderRadius: 16, background: 'rgba(255,125,139,0.10)', opacity: title }} />
        ))}

        {chain.legs.map((leg, index) => (
          <Lane key={leg.team} team={leg.team} dates={chain.dates} from={leg.from} to={leg.to} games={leg.games} delay={30 + index * 55} caption={legCaption(leg)} />
        ))}
        {chain.bridge && (
          <Lane team={chain.bridge.team} dates={chain.dates} from={chain.bridge.games[0]} to={chain.bridge.games[chain.bridge.games.length - 1]} games={chain.bridge.games} delay={30 + chain.legs.length * 55 + 20} dashed caption="Optional 3rd add" />
        )}
      </div>

      <div style={{ marginTop: 80, opacity: result, transform: `translateY(${(1 - result) * 30}px)` }}>
        {chain.usable !== null && (
          <div style={{ fontFamily: body, fontSize: 38, lineHeight: 1.3, color: C.ink }}>
            <span style={{ color: C.green, fontWeight: 700 }}>{chain.usable} games that fit a lineup</span> from one roster spot, on nights most teams have room.
          </div>
        )}
        {chain.bridge && (
          <div style={{ marginTop: 18, fontFamily: body, fontSize: 30, lineHeight: 1.3, color: C.dim }}>
            Third add? A {TEAM_NAMES[chain.bridge.team]?.replace(/s$/, '') ?? chain.bridge.team} plays Sunday and next Monday: a free head start on next week.
          </div>
        )}
      </div>
    </div>
  );
}
