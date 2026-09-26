import { interpolate, useCurrentFrame } from 'remotion';
import { CONTENT } from '../layout';
import { body, C, display } from '../theme';
import type { WeekProps } from '../types';

/**
 * Complete on frame 0 (it's also what people see mid-scroll): the one thing to do
 * differently this week, then a red swipe under the trap night.
 */
export function Hook({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const swipe = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const night = props.packedNight?.day ?? 'the busy night';
  return (
    <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 560 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 38, color: C.ice }}>Your Week {props.weekNumber} streaming plan</div>
      <div style={{ marginTop: 26, fontFamily: display, fontWeight: 800, fontSize: 150, lineHeight: 0.98, color: C.ink, letterSpacing: -3 }}>
        Stop streaming <span style={{ position: 'relative', color: C.red, whiteSpace: 'nowrap' }}>
          {night}.
          <span style={{ position: 'absolute', left: 0, bottom: -8, height: 16, width: `${swipe * 100}%`, borderRadius: 8, background: C.red }} />
        </span>
      </div>
      <div style={{ marginTop: 60, fontFamily: body, fontSize: 44, lineHeight: 1.3, color: C.dim }}>
        {props.totalGames} games this week. Here's where the room is.
      </div>
    </div>
  );
}
