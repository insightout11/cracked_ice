import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, enter } from '../theme';
import type { WeekProps } from '../types';

function Line({ delay, color = C.ink, size = 104, children }: { delay: number; color?: string; size?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enter(frame, fps, delay);
  return (
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 1.02, color, opacity: t, transform: `translateY(${(1 - t) * 60}px)`, letterSpacing: -2 }}>
      {children}
    </div>
  );
}

/** "39 games. 5 quiet nights. Skip Saturday." */
export function Hook({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.round(interpolate(frame, [4, 34], [0, props.totalGames], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const sub = enter(frame, fps, 70);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 18 }}>
      <Line delay={0}>{count} games.</Line>
      <Line delay={26} color={C.ice}>{props.quietNights} quiet nights.</Line>
      {props.packedNight && <Line delay={50} color={C.red}>Skip {props.packedNight.day}.</Line>}
      <div style={{ marginTop: 40, fontFamily: body, fontSize: 40, lineHeight: 1.3, color: C.dim, opacity: sub }}>
        Where the streaming games are this week, in 30 seconds.
      </div>
    </div>
  );
}
