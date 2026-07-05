import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FadeInOut, PopIn} from '../components';
import {FONT, MONO, T} from '../theme';

const DURATION = 210;

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const word = spring({frame: frame - 5, fps, config: {damping: 200, stiffness: 100}});
  const pulse = 1 + Math.sin(frame / 9) * 0.04;

  const links = [
    'github.com/BenAlaf/crash-monitoring-sdk',
    'com.github.BenAlaf:crash-monitoring-sdk:1.0.0',
    'MIT licensed',
  ];

  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, opacity: word}}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              background: T.red,
              transform: `scale(${pulse})`,
              boxShadow: `0 0 0 12px ${T.redWash}`,
            }}
          />
          <div
            style={{
              fontFamily: FONT,
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: T.ink,
            }}
          >
            CrashMonitor
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontSize: 40,
            fontWeight: 600,
            color: T.ink2,
            marginTop: 8,
            opacity: interpolate(frame, [25, 45], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          Know your crashes.
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 56, alignItems: 'center'}}>
          {links.map((text, i) => (
            <PopIn key={text} at={60 + i * 18}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 27,
                  color: i === 0 ? T.blue : T.ink2,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '10px 26px',
                }}
              >
                {text}
              </div>
            </PopIn>
          ))}
        </div>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const OUTRO_DURATION = DURATION;
