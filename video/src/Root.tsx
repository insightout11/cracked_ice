import { Composition } from 'remotion';
import week from './data/week.json';
import scenes from './scenes.json';
import type { WeekProps } from './types';
import { WEEKLY_EDGE_FRAMES, WeeklyEdge } from './WeeklyEdge';

export function RemotionRoot() {
  return (
    <Composition
      id="WeeklyEdge"
      component={WeeklyEdge}
      durationInFrames={WEEKLY_EDGE_FRAMES}
      fps={scenes.fps}
      width={scenes.width}
      height={scenes.height}
      defaultProps={week as WeekProps}
    />
  );
}
