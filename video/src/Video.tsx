import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, Series, staticFile} from 'remotion';
import {MUSIC_ENABLED, T} from './theme';
import {Problem, PROBLEM_DURATION} from './scenes/Problem';
import {Intro, INTRO_DURATION} from './scenes/Intro';
import {Architecture, ARCHITECTURE_DURATION} from './scenes/Architecture';
import {Demo, DEMO_DURATION} from './scenes/Demo';
import {Portal, PORTAL_DURATION} from './scenes/Portal';
import {CodeScene, CODE_DURATION} from './scenes/CodeScene';
import {Outro, OUTRO_DURATION} from './scenes/Outro';

export const TOTAL_DURATION =
  PROBLEM_DURATION +
  INTRO_DURATION +
  ARCHITECTURE_DURATION +
  DEMO_DURATION +
  PORTAL_DURATION +
  CODE_DURATION +
  OUTRO_DURATION;

// scene start frames on the global timeline
const SCENE_START = {
  problem: 0,
  intro: PROBLEM_DURATION,
  architecture: PROBLEM_DURATION + INTRO_DURATION,
  demo: PROBLEM_DURATION + INTRO_DURATION + ARCHITECTURE_DURATION,
  portal: PROBLEM_DURATION + INTRO_DURATION + ARCHITECTURE_DURATION + DEMO_DURATION,
  code:
    PROBLEM_DURATION + INTRO_DURATION + ARCHITECTURE_DURATION + DEMO_DURATION + PORTAL_DURATION,
  outro:
    PROBLEM_DURATION +
    INTRO_DURATION +
    ARCHITECTURE_DURATION +
    DEMO_DURATION +
    PORTAL_DURATION +
    CODE_DURATION,
};

// voiceover clips, each with a small lead-in so the visuals land first
const VOICEOVER: {src: string; from: number}[] = [
  {src: 'scene1.wav', from: SCENE_START.problem + 14},
  {src: 'scene2.wav', from: SCENE_START.intro + 12},
  {src: 'scene3.wav', from: SCENE_START.architecture + 16},
  {src: 'scene4.wav', from: SCENE_START.demo + 20},
  {src: 'scene5.wav', from: SCENE_START.portal + 12},
  {src: 'scene6.wav', from: SCENE_START.code + 14},
  {src: 'scene7.wav', from: SCENE_START.outro + 10},
];

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: T.page}}>
      {MUSIC_ENABLED && (
        <Audio
          src={staticFile('music.mp3')}
          volume={(f) =>
            interpolate(f, [0, 45, TOTAL_DURATION - 90, TOTAL_DURATION], [0, 0.14, 0.14, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
      {VOICEOVER.map(({src, from}) => (
        <Sequence key={src} from={from}>
          <Audio src={staticFile(src)} />
        </Sequence>
      ))}
      <Series>
        <Series.Sequence durationInFrames={PROBLEM_DURATION}>
          <Problem />
        </Series.Sequence>
        <Series.Sequence durationInFrames={INTRO_DURATION}>
          <Intro />
        </Series.Sequence>
        <Series.Sequence durationInFrames={ARCHITECTURE_DURATION}>
          <Architecture />
        </Series.Sequence>
        <Series.Sequence durationInFrames={DEMO_DURATION}>
          <Demo />
        </Series.Sequence>
        <Series.Sequence durationInFrames={PORTAL_DURATION}>
          <Portal />
        </Series.Sequence>
        <Series.Sequence durationInFrames={CODE_DURATION}>
          <CodeScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={OUTRO_DURATION}>
          <Outro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
