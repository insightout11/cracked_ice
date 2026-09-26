import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONTENT } from '../layout';
import { body, C, display, enter } from '../theme';

/** Links aren't clickable in shorts: point to the bio, and set up next week's episode. */
export function Cta() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = enter(frame, fps, 0, { damping: 14 });
  const text = enter(frame, fps, 8);
  const next = enter(frame, fps, 26);
  return (
    <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 480 }}>
      <Img src={staticFile('logo-mark.svg')} style={{ width: 220, height: 220, transform: `scale(${mark}) rotate(${(1 - mark) * -25}deg)`, opacity: mark }} />
      <div style={{ marginTop: 50, fontFamily: display, fontWeight: 800, fontSize: 96, lineHeight: 1.02, color: C.ink, opacity: text, transform: `translateY(${(1 - text) * 40}px)` }}>
        Plan <span style={{ color: C.ice }}>your</span> team's stream.
      </div>
      <div style={{ marginTop: 34, fontFamily: display, fontWeight: 800, fontSize: 60, color: C.ice, opacity: text }}>Link in bio.</div>
      <div style={{ marginTop: 60, fontFamily: body, fontWeight: 600, fontSize: 40, lineHeight: 1.3, color: C.dim, opacity: next }}>
        New plan every Sunday. Follow so you don't miss Week 2.
      </div>
      <div style={{ marginTop: 16, fontFamily: body, fontSize: 30, color: C.mute, opacity: next }}>crackedicehockey.com</div>
    </div>
  );
}
