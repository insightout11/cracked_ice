import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, C, display, enter } from '../theme';
import type { WeekProps } from '../types';

const BAR_AREA = 640;

/** Share of fantasy rosters with room for another forward, night by night. */
export function Nights({ props }: { props: WeekProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = enter(frame, fps, 0);
  const caption = enter(frame, fps, 120);
  const packed = props.packedNight;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 68, lineHeight: 1.05, color: C.ink }}>Room to stream, night by night</div>
        <div style={{ marginTop: 16, fontFamily: body, fontSize: 32, color: C.dim }}>Share of fantasy rosters with an open forward spot</div>
      </div>

      <div style={{ marginTop: 70, display: 'flex', gap: 18, alignItems: 'flex-end', height: BAR_AREA + 150 }}>
        {props.nights.map((night, index) => {
          const grow = enter(frame, fps, 20 + index * 7);
          const color = night.packed ? C.red : night.light ? C.ice : C.dim;
          const shown = Math.round(night.room * grow);
          const tag = night.packed ? enter(frame, fps, 95, { damping: 12 }) : 0;
          return (
            <div key={night.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {night.packed && (
                <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 12, background: C.red, color: C.bg, fontFamily: display, fontWeight: 800, fontSize: 26, transform: `scale(${tag})`, opacity: tag }}>SKIP</div>
              )}
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40, color }}>{shown}%</div>
              <div style={{ marginTop: 10, width: '100%', height: (BAR_AREA * night.room * grow) / 100, borderRadius: '16px 16px 6px 6px', background: night.packed ? `linear-gradient(${C.red}, rgba(255,125,139,0.35))` : `linear-gradient(${C.ice}, rgba(47,211,201,0.35))` }} />
              <div style={{ marginTop: 16, fontFamily: body, fontWeight: 700, fontSize: 34, color: C.ink }}>{night.label}</div>
              <div style={{ fontFamily: body, fontSize: 26, color: night.packed ? C.red : C.mute }}>{night.games} games</div>
            </div>
          );
        })}
      </div>

      {packed && (
        <div style={{ marginTop: 50, fontFamily: body, fontSize: 38, lineHeight: 1.3, color: C.ink, opacity: caption, transform: `translateY(${interpolate(caption, [0, 1], [30, 0])}px)` }}>
          {packed.day}: {packed.games} games, and only <span style={{ color: C.red, fontWeight: 700 }}>{packed.room}%</span> of rosters have room. Anyone you add just for {packed.day} probably sits.
        </div>
      )}
    </div>
  );
}
