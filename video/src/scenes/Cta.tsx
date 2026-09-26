import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, enter } from '../theme';

/** Send people to the full breakdown and the planner for their own roster. */
export function Cta() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = enter(frame, fps, 0, { damping: 14 });
  const text = enter(frame, fps, 14);
  const link = enter(frame, fps, 34);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <Img src={staticFile('logo-mark.svg')} style={{ width: 220, height: 220, transform: `scale(${mark}) rotate(${(1 - mark) * -25}deg)`, opacity: mark }} />
      <div style={{ marginTop: 50, fontFamily: display, fontWeight: 800, fontSize: 84, lineHeight: 1.04, color: C.ink, opacity: text, transform: `translateY(${(1 - text) * 40}px)` }}>
        Plan the stream for your own team.
      </div>
      <div style={{ marginTop: 34, fontFamily: body, fontSize: 38, lineHeight: 1.35, color: C.dim, opacity: link }}>
        Every team, every option and the full breakdown, free at
      </div>
      <div style={{ marginTop: 10, fontFamily: display, fontWeight: 800, fontSize: 56, color: C.ice, opacity: link }}>crackedicehockey.com</div>
    </div>
  );
}
