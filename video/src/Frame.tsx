import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CONTENT } from './layout';
import { body, C, display } from './theme';

/** Arena glow from the top and faint rink lines, drifting slowly. */
export function Backdrop() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 700], [0, -60]);
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

/** Brand and week label at the top; scenes draw in frame coordinates (see layout.ts). */
export function Frame({ weekNumber, weekLabel, children }: { weekNumber: number; weekLabel: string; children: ReactNode }) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: 'absolute', left: CONTENT.left, top: 120, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Img src={staticFile('logo-mark.svg')} style={{ width: 64, height: 64 }} />
        <div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, color: C.ink, letterSpacing: 1 }}>WEEKLY EDGE</div>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 24, color: C.ice }}>Week {weekNumber} · {weekLabel}</div>
        </div>
      </div>
      {children}
    </AbsoluteFill>
  );
}

/** A slow push-in through the whole scene, so nothing sits still once it has animated. Scenes cut, they don't fade. */
export function PushIn({ frames, children }: { frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, frames], [1, 1.035], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: '50% 45%' }}>{children}</AbsoluteFill>;
}
