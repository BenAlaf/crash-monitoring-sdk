import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Caption, FadeInOut, PhoneFrame} from '../components';
import {FONT, T} from '../theme';

const DURATION = 270;
const CRASH_AT = 55;

/** A generic "any app" skeleton that dies mid-scroll. */
const SkeletonApp: React.FC = () => {
  const frame = useCurrentFrame();
  const crashed = frame >= CRASH_AT;

  // small screen-shake right at the crash moment
  const shake = crashed
    ? Math.sin(frame * 2.2) *
      interpolate(frame, [CRASH_AT, CRASH_AT + 14], [7, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const bars = [220, 160, 250, 190, 230, 150, 210];
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${shake}px)`}}>
      <div style={{height: 64, background: T.blue}} />
      <div style={{padding: 22, display: 'flex', flexDirection: 'column', gap: 16}}>
        {bars.map((w, i) => (
          <div key={i} style={{display: 'flex', gap: 12, alignItems: 'center'}}>
            <div style={{width: 40, height: 40, borderRadius: 20, background: T.grid}} />
            <div style={{width: w, height: 16, borderRadius: 8, background: T.grid}} />
          </div>
        ))}
      </div>
      {crashed && (
        <AbsoluteFill
          style={{
            background: 'rgba(252,252,251,0.96)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              background: T.redWash,
              border: `4px solid ${T.red}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontFamily: FONT,
              color: T.red,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div style={{fontFamily: FONT, fontSize: 26, fontWeight: 650, color: T.ink}}>
            App keeps stopping
          </div>
        </AbsoluteFill>
      )}
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const tilt = interpolate(frame, [0, DURATION], [-2, 2]);

  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page}}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 35%, ${
              frame >= CRASH_AT ? T.redWash : T.blueWash
            } 0%, transparent 60%)`,
          }}
        />
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <PhoneFrame width={330} style={{transform: `rotate(${tilt}deg) translateY(-60px)`}}>
            <SkeletonApp />
          </PhoneFrame>
        </AbsoluteFill>

        <Caption at={12} until={95} size={62}>
          Your app just crashed.
        </Caption>
        <Caption at={100} until={175} size={62}>
          In production. On a user's phone.
        </Caption>
        <Caption at={182} until={DURATION - 8} size={62} color={T.red}>
          Would you even know?
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const PROBLEM_DURATION = DURATION;
