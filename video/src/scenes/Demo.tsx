import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {Caption, FadeInOut, PhoneFrame} from '../components';
import {T} from '../theme';

const DURATION = 450;
const FPS = 30;

/**
 * Real emulator footage (public/demo.webm), shown in three trimmed segments:
 *   A  4.5s–8.6s   healthy app → breadcrumb → tap crash → app dies
 *   B  13.6s–16.2s relaunch → "pending reports: 1"
 *   C  16.2s–19.4s queue drains → "pending reports: 0"
 * B+C are one contiguous stretch; we keep them as one clip and zoom into the
 * status line while the counter flips.
 */
const Clip: React.FC<{
  fromSeconds: number;
  zoomStatus?: boolean;
}> = ({fromSeconds, zoomStatus}) => (
  <PhoneFrame width={370}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: zoomStatus ? 'scale(2.3) translateY(26%)' : undefined,
        transformOrigin: 'top center',
      }}
    >
      <OffthreadVideo
        src={staticFile('demo.webm')}
        startFrom={Math.round(fromSeconds * FPS)}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
        muted
      />
    </div>
  </PhoneFrame>
);

export const Demo: React.FC = () => {
  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page}}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 30%, ${T.blueWash} 0%, transparent 55%)`,
          }}
        />

        {/* Segment A: healthy → crash (local frames 0–125, video 4.5s→8.7s) */}
        <Sequence durationInFrames={125}>
          <AbsoluteFill
            style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 110}}
          >
            <Clip fromSeconds={4.5} />
          </AbsoluteFill>
        </Sequence>

        {/* Segment B: relaunch, pending: 1 → 0 (local 125–330, video 13.8s→) */}
        <Sequence from={125} durationInFrames={205}>
          <AbsoluteFill
            style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 110}}
          >
            <Clip fromSeconds={13.8} />
          </AbsoluteFill>
        </Sequence>

        {/* Segment C: zoom on the status line — catches "pending: 1" flipping to 0 */}
        <Sequence from={330} durationInFrames={DURATION - 330}>
          <AbsoluteFill
            style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 110}}
          >
            <Clip fromSeconds={14.6} zoomStatus />
          </AbsoluteFill>
        </Sequence>

        <Caption at={8} until={78} size={48}>
          The real thing — no mockups.
        </Caption>
        <Caption at={82} until={125} size={48} color={T.red}>
          Tap. Crash. Process dead.
        </Caption>
        <Caption at={132} until={250} size={48}>
          Reopen the app —
        </Caption>
        <Caption at={254} until={DURATION - 8} size={48}>
          the report uploads <span style={{color: T.blue}}>automatically.</span>
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const DEMO_DURATION = DURATION;
