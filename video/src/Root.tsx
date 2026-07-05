import React from 'react';
import {Composition} from 'remotion';
import {PromoVideo, TOTAL_DURATION} from './Video';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CrashMonitorPromo"
      component={PromoVideo}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
