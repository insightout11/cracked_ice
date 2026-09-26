import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { barRect, BARS, CONTENT } from '../layout';
import { body, C, display, enter } from '../theme';
import type { WeekProps } from '../types';
import { saturdayColumn } from './Chain';

/** Frames at the end where the packed night's bar becomes the chain's shaded column. */
export const HANDOFF = 16;

/** Share of fantasy rosters with room for another forward, night by night. */
export function Nights({ props, frames }: { props: WeekProps; frames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const handoff = interpolate(frame, [frames - HANDOFF, frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - (1 - handoff) ** 3;
  const rest = 1 - handoff;
  const title = enter(frame, fps, 0);
  const caption = enter(frame, fps, 70);
  const packed = props.packedNight;
  const target = saturdayColumn(props);
  return (
    <>
      <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: 250, opacity: title * rest }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 76, lineHeight: 1.02, color: C.ink }}>
          {props.totalGames} games. <span style={{ color: C.ice }}>{props.quietNights} quiet nights.</span>
        </div>
        <div style={{ marginTop: 18, fontFamily: body, fontSize: 34, color: C.dim }}>Fantasy rosters with room for a streamer</div>
      </div>

      {props.nights.map((night, index) => {
        const grow = enter(frame, fps, 10 + index * 6);
        const full = barRect(index, props.nights.length, night.room);
        const bar = { ...full, y: BARS.base - full.height * grow, height: full.height * grow };
        const color = night.packed ? C.red : C.ice;
        const tag = night.packed ? enter(frame, fps, 55, { damping: 12 }) : 0;
        // The packed night's bar travels to the chain grid's column; the rest fade out.
        const rect = night.packed && target
          ? {
              x: interpolate(eased, [0, 1], [bar.x, target.x]),
              y: interpolate(eased, [0, 1], [bar.y, target.y]),
              width: interpolate(eased, [0, 1], [bar.width, target.width]),
              height: interpolate(eased, [0, 1], [bar.height, target.height]),
            }
          : bar;
        return (
          <div key={night.date}>
            <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: 16, opacity: night.packed ? 1 : rest, background: night.packed ? `linear-gradient(${C.red}, rgba(255,125,139,${0.35 + 0.4 * handoff}))` : `linear-gradient(${C.ice}, rgba(47,211,201,0.3))` }} />
            <div style={{ position: 'absolute', left: full.x, width: full.width, top: bar.y - 62, textAlign: 'center', fontFamily: display, fontWeight: 800, fontSize: 40, color, opacity: rest }}>{Math.round(night.room * grow)}%</div>
            {night.packed && <div style={{ position: 'absolute', left: full.x, width: full.width, top: bar.y - 128, display: 'flex', justifyContent: 'center', opacity: tag * rest }}>
              <div style={{ padding: '8px 16px', borderRadius: 12, background: C.red, color: C.bg, fontFamily: display, fontWeight: 800, fontSize: 28, transform: `scale(${tag})` }}>SKIP</div>
            </div>}
            <div style={{ position: 'absolute', left: full.x, width: full.width, top: BARS.base + 18, textAlign: 'center', opacity: rest }}>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 36, color: night.packed ? C.red : C.ink }}>{night.label}</div>
              <div style={{ fontFamily: body, fontSize: 26, color: night.packed ? C.red : C.mute }}>{night.games} games</div>
            </div>
          </div>
        );
      })}

      {packed && (
        <div style={{ position: 'absolute', left: CONTENT.left, right: 1080 - CONTENT.right, top: BARS.base + 150, fontFamily: display, fontWeight: 800, fontSize: 52, lineHeight: 1.12, color: C.ink, opacity: caption * rest, transform: `translateY(${(1 - caption) * 30}px)` }}>
          {packed.day}: {packed.games} games. Only <span style={{ color: C.red }}>{packed.room}%</span> have room.
        </div>
      )}
    </>
  );
}
