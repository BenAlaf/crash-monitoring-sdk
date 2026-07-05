import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption, FadeInOut} from '../components';
import {FONT, T} from '../theme';

const DURATION = 180;

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const dot = spring({frame: frame - 8, fps, config: {damping: 12, stiffness: 150}});
  const word = spring({frame: frame - 22, fps, config: {damping: 200, stiffness: 90}});

  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 34, transform: 'translateY(-40px)'}}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: T.red,
              transform: `scale(${dot})`,
              boxShadow: `0 0 0 ${dot * 18}px ${T.redWash}`,
            }}
          />
          <div
            style={{
              fontFamily: FONT,
              fontSize: 120,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: T.ink,
              opacity: word,
              transform: `translateX(${(1 - word) * 40}px)`,
            }}
          >
            CrashMonitor
          </div>
        </div>

        <Caption at={45} until={DURATION - 8} size={44} color={T.ink2}>
          Crash &amp; error monitoring for Android
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const INTRO_DURATION = DURATION;
