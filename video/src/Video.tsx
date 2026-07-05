import React from 'react';
import {AbsoluteFill, Audio, Series, staticFile} from 'remotion';
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

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: T.page}}>
      {MUSIC_ENABLED && <Audio src={staticFile('music.mp3')} volume={0.5} />}
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
