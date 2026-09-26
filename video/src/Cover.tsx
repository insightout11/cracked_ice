import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Backdrop } from './Frame';
import { CONTENT } from './layout';
import { body, C, display, logoUrl } from './theme';
import type { WeekProps } from './types';

/** Cover image for the Instagram grid and YouTube Shorts: the series, the week, the chain's teams. */
export function Cover(props: WeekProps) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 420 }}>
        <Img src={staticFile('logo-mark.svg')} style={{ width: 150, height: 150 }} />
        <div style={{ marginTop: 40, fontFamily: display, fontWeight: 800, fontSize: 64, color: C.ice, letterSpacing: 2 }}>WEEKLY EDGE</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 190, lineHeight: 0.95, color: C.ink, letterSpacing: -4 }}>Week {props.weekNumber}</div>
        <div style={{ marginTop: 30, fontFamily: display, fontWeight: 800, fontSize: 70, lineHeight: 1.05, color: C.ink }}>
          Streaming plan{props.packedNight ? <>, <span style={{ color: C.red }}>skip {props.packedNight.day}</span></> : ''}
        </div>
        <div style={{ marginTop: 70, display: 'flex', gap: 30 }}>
          {[...props.chain.legs.map((leg) => leg.team), ...(props.chain.bridge ? [props.chain.bridge.team] : [])].map((team) => (
            <Img key={team} src={logoUrl(team)} style={{ width: 150, height: 150 }} />
          ))}
        </div>
        <div style={{ marginTop: 60, fontFamily: body, fontWeight: 600, fontSize: 38, color: C.dim }}>{props.weekLabel}</div>
      </div>
    </AbsoluteFill>
  );
}
