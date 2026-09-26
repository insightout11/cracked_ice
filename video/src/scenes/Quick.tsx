import { Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONTENT } from '../layout';
import { body, C, display, enter, logoUrl, TEAM_NAMES } from '../theme';
import type { WeekProps } from '../types';

const HORIZONS: Array<{ key: keyof WeekProps['quickHits']; title: string }> = [
  { key: 'week', title: 'This week' },
  { key: 'twoWeeks', title: 'Next 2 weeks' },
  { key: 'month', title: 'Next 30 days' },
];

function Card({ title, teams }: { title: string; teams: Array<{ team: string }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = teams.slice(0, 3);
  return (
    <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 520 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 40, color: C.ice }}>Target</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 110, lineHeight: 1, color: C.ink }}>{title}</div>
      <div style={{ marginTop: 90, display: 'flex', flexDirection: 'column', gap: 40 }}>
        {shown.map((hit, index) => {
          const slam = enter(frame, fps, index * 4, { damping: 13, stiffness: 220 });
          return (
            <div key={hit.team} style={{ display: 'flex', alignItems: 'center', gap: 34, opacity: Math.min(1, slam * 2), transform: `scale(${1.25 - 0.25 * slam})`, transformOrigin: 'left center' }}>
              <Img src={logoUrl(hit.team)} style={{ width: index === 0 ? 170 : 120, height: index === 0 ? 170 : 120 }} />
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: index === 0 ? 76 : 56, color: index === 0 ? C.ink : C.dim }}>{TEAM_NAMES[hit.team] ?? hit.team}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Quick hits as three fast cards, one per horizon; the full lists live in the post. */
export function Quick({ props, frames }: { props: WeekProps; frames: number }) {
  const each = Math.floor(frames / HORIZONS.length);
  return (
    <>
      {HORIZONS.map((horizon, index) => (
        <Sequence key={horizon.key} from={index * each} durationInFrames={index === HORIZONS.length - 1 ? frames - index * each : each} layout="none">
          <Card title={horizon.title} teams={props.quickHits[horizon.key]} />
        </Sequence>
      ))}
    </>
  );
}
