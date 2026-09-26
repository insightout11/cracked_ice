import { Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, enter, logoUrl, TEAM_NAMES } from '../theme';
import type { WeekProps } from '../types';

const SECTIONS: Array<{ key: keyof WeekProps['quickHits']; title: string }> = [
  { key: 'week', title: 'This week' },
  { key: 'twoWeeks', title: 'Next 2 weeks' },
  { key: 'month', title: 'Next 30 days' },
];

/** Teams to target over three horizons, for anyone who only has five seconds. */
export function Quick({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = enter(frame, fps, 0);
  let row = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 68, color: C.ink, opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>Quick hits</div>
      {SECTIONS.map((section, sectionIndex) => (
        <div key={section.key} style={{ marginTop: sectionIndex === 0 ? 34 : 40 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 30, color: C.ice, opacity: enter(frame, fps, 10 + sectionIndex * 30) }}>{section.title}</div>
          {props.quickHits[section.key].map((hit) => {
            const t = enter(frame, fps, 16 + row++ * 8);
            return (
              <div key={hit.team} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 22, opacity: t, transform: `translateX(${(1 - t) * -50}px)` }}>
                <Img src={logoUrl(hit.team)} style={{ width: 62, height: 62 }} />
                <div>
                  <div style={{ fontFamily: display, fontWeight: 800, fontSize: 38, lineHeight: 1.05, color: C.ink }}>{TEAM_NAMES[hit.team] ?? hit.team}</div>
                  {section.key === 'week' && <div style={{ fontFamily: body, fontSize: 26, color: C.dim }}>{hit.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
