import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Caption, FadeInOut} from '../components';
import {T} from '../theme';

const DURATION = 570;
const SWITCH = 400; // dashboard → issue page

/**
 * Browser-framed screenshot with a slow programmatic camera:
 * keyframed scale/x/y over the dashboard (KPIs → chart → breakdown),
 * then a cut to the issue page drifting over the stack trace.
 */
const Browser: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      width: 1560,
      height: 860,
      borderRadius: 18,
      overflow: 'hidden',
      border: `1px solid ${T.border}`,
      boxShadow: '0 30px 90px rgba(11,11,11,0.22)',
      background: '#101010',
    }}
  >
    <div
      style={{
        height: 44,
        background: '#1c1c1b',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 18,
      }}
    >
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
        <div key={c} style={{width: 13, height: 13, borderRadius: 7, background: c}} />
      ))}
      <div
        style={{
          marginLeft: 16,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 15,
          color: '#9a9a94',
        }}
      >
        crash-monitoring-sdk.vercel.app/portal
      </div>
    </div>
    <div style={{position: 'relative', width: '100%', height: 816, overflow: 'hidden'}}>
      {children}
    </div>
  </div>
);

export const Portal: React.FC = () => {
  const frame = useCurrentFrame();

  // camera over the dashboard: [scale, translateX %, translateY %]
  const cam = (ranges: number[], values: number[]) =>
    interpolate(frame, ranges, values, {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: (t) => 1 - (1 - t) * (1 - t),
    });

  const dashScale = cam([0, 90, 170, 260, 340, SWITCH], [1.7, 1.7, 1.35, 1.9, 1.9, 1.05]);
  const dashX = cam([0, 90, 170, 260, 340, SWITCH], [22, 22, 10, -24, -24, 0]);
  const dashY = cam([0, 90, 170, 260, 340, SWITCH], [30, 30, 4, -2, -2, 0]);

  const issueScale = cam([SWITCH, SWITCH + 40, DURATION], [1.15, 1.35, 1.5]);
  const issueY = cam([SWITCH, DURATION], [8, -26]);

  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill
        style={{
          background: T.page,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 130,
        }}
      >
        <Browser>
          {frame < SWITCH ? (
            <Img
              src={staticFile('portal-dashboard.png')}
              style={{
                width: '100%',
                transform: `scale(${dashScale}) translate(${dashX}%, ${dashY}%)`,
                transformOrigin: 'center center',
              }}
            />
          ) : (
            <Img
              src={staticFile('portal-issue.png')}
              style={{
                width: '100%',
                transform: `scale(${issueScale}) translateY(${issueY}%)`,
                transformOrigin: 'center center',
              }}
            />
          )}
        </Browser>

        <Caption at={10} until={160} size={48}>
          Crash-free users, at a glance.
        </Caption>
        <Caption at={168} until={255} size={48}>
          Fatal vs handled, day by day.
        </Caption>
        <Caption at={263} until={SWITCH - 5} size={48}>
          Which versions. Which devices.
        </Caption>
        <Caption at={SWITCH + 8} until={DURATION - 8} size={48}>
          Full stack traces, breadcrumbs, every occurrence.
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const PORTAL_DURATION = DURATION;
