import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, SAFE } from './theme';

/** Arena glow from the top and faint rink lines, drifting slowly. */
export function Backdrop() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 960], [0, -60]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 60% at 20% ${-5 + drift / 20}%, rgba(99,230,255,0.20), rgba(99,230,255,0) 70%)` }} />
      <svg width="1080" height="1920" style={{ position: 'absolute', opacity: 0.07, transform: `translateY(${drift}px)` }}>
        <line x1="0" y1="700" x2="1080" y2="700" stroke={C.ice} strokeWidth="6" />
        <line x1="0" y1="1300" x2="1080" y2="1300" stroke={C.ice} strokeWidth="6" />
        <circle cx="540" cy="1000" r="230" fill="none" stroke={C.ice} strokeWidth="4" />
        <line x1="0" y1="1000" x2="1080" y2="1000" stroke={C.red} strokeWidth="6" />
      </svg>
    </AbsoluteFill>
  );
}

/** Brand and week label at the top, the site at the bottom; the scene fills between. */
export function Frame({ weekNumber, weekLabel, footer = true, children }: { weekNumber: number; weekLabel: string; footer?: boolean; children: ReactNode }) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: 'absolute', left: SAFE.left, top: 120, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Img src={staticFile('logo-mark.svg')} style={{ width: 64, height: 64 }} />
        <div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, color: C.ink, letterSpacing: 1 }}>WEEKLY EDGE</div>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 24, color: C.ice }}>Week {weekNumber} · {weekLabel}</div>
        </div>
      </div>
      <AbsoluteFill style={{ top: SAFE.top, bottom: SAFE.bottom, left: SAFE.left, right: SAFE.right, width: 'auto', height: 'auto' }}>
        {children}
      </AbsoluteFill>
      {footer && <div style={{ position: 'absolute', left: SAFE.left, bottom: 300, fontFamily: body, fontWeight: 600, fontSize: 26, color: C.mute }}>crackedicehockey.com</div>}
    </AbsoluteFill>
  );
}

/** Fades a scene out over its last frames, so cuts between scenes don't jump. */
export function SceneFade({ frames, children }: { frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [frames - Math.round(fps / 3), frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: out }}>{children}</AbsoluteFill>;
}
