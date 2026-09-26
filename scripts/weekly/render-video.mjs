/**
 * Renders the Weekly Edge short (1080x1920, about 22 seconds) with Remotion.
 *
 *   node scripts/weekly/render-video.mjs --start 2026-09-28            storyboard: one still per scene
 *   node scripts/weekly/render-video.mjs --start 2026-09-28 --video    the MP4 and the cover image
 *
 * A voiceover, if recorded, goes in content/social/<season>/video/week-<start>-voice.(m4a|mp3|wav);
 * it's copied into video/public/ and laid under the video. The script to read is
 * content/social/<season>/week-<start>-video-script.md.
 *
 * Props come from scripts/weekly/video-props.mjs (the same weekly JSON and editorial
 * file as the graphics). Output goes to content/social/<season>/video/, which is not
 * committed: every render can be rebuilt from the data. Needs `npm install` in video/.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVideoProps } from './video-props.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const videoDir = path.join(root, 'video');
const start = process.argv[process.argv.indexOf('--start') + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '')) throw new Error('--start YYYY-MM-DD is required');
if (!fs.existsSync(path.join(videoDir, 'node_modules'))) throw new Error('Run `npm install` in video/ first.');

const season = JSON.parse(fs.readFileSync(path.join(root, 'config/season.json'), 'utf8'));
const outDir = path.join(root, 'content/social', season.label, 'video');
fs.mkdirSync(outDir, { recursive: true });

const props = buildVideoProps(start);
const voice = ['m4a', 'mp3', 'wav'].map((ext) => path.join(outDir, `week-${start}-voice.${ext}`)).find((file) => fs.existsSync(file));
if (voice) {
  const name = `voice${path.extname(voice)}`;
  fs.copyFileSync(voice, path.join(videoDir, 'public', name));
  props.voiceover = name;
  console.log(`Using voiceover ${path.relative(root, voice)}`);
}
fs.writeFileSync(path.join(videoDir, 'src/data/week.json'), `${JSON.stringify(props, null, 2)}\n`);
const propsFile = path.join(outDir, `week-${start}-props.json`);
fs.writeFileSync(propsFile, JSON.stringify(props));

const remotion = (args) => execFileSync(process.execPath, [path.join(videoDir, 'node_modules/@remotion/cli/remotion-cli.js'), ...args, `--props=${propsFile}`], { cwd: videoDir, stdio: 'inherit' });

if (process.argv.includes('--video')) {
  const out = path.join(outDir, `week-${start}-short.mp4`);
  remotion(['render', 'src/index.ts', 'WeeklyEdge', out, '--codec=h264', '--crf=18']);
  const cover = path.join(outDir, `week-${start}-cover.png`);
  remotion(['still', 'src/index.ts', 'WeeklyEdgeCover', cover]);
  console.log(`Wrote ${path.relative(root, out)} and ${path.relative(root, cover)}`);
} else {
  const { scenes } = JSON.parse(fs.readFileSync(path.join(videoDir, 'src/scenes.json'), 'utf8'));
  let offset = 0;
  scenes.forEach((scene, index) => {
    const out = path.join(outDir, `week-${start}-storyboard-${index + 1}-${scene.id}.png`);
    remotion(['still', 'src/index.ts', 'WeeklyEdge', out, `--frame=${offset + scene.still}`]);
    offset += scene.frames;
  });
  console.log(`Wrote ${scenes.length} storyboard stills to ${path.relative(root, outDir)}`);
}
