import { AbsoluteFill, Series } from 'remotion';
import { Frame, SceneFade } from './Frame';
import scenes from './scenes.json';
import { Chain } from './scenes/Chain';
import { Cta } from './scenes/Cta';
import { Hook } from './scenes/Hook';
import { Nights } from './scenes/Nights';
import { Quick } from './scenes/Quick';
import type { WeekProps } from './types';

const frames = Object.fromEntries(scenes.scenes.map((scene) => [scene.id, scene.frames]));

export const WEEKLY_EDGE_FRAMES = scenes.scenes.reduce((sum, scene) => sum + scene.frames, 0);

/** The Weekly Edge short: hook, the week's nights, the featured chain, quick hits, where to go next. */
export function WeeklyEdge(props: WeekProps) {
  const parts: Array<[string, JSX.Element]> = [
    ['hook', <Hook props={props} />],
    ['nights', <Nights props={props} />],
    ['chain', <Chain props={props} />],
    ['quick', <Quick props={props} />],
    ['cta', <Cta />],
  ];
  return (
    <AbsoluteFill>
      <Series>
        {parts.map(([id, scene]) => (
          <Series.Sequence key={id} durationInFrames={frames[id]}>
            <Frame weekNumber={props.weekNumber} weekLabel={props.weekLabel} footer={id !== 'cta'}>
              <SceneFade frames={frames[id]}>{scene}</SceneFade>
            </Frame>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
