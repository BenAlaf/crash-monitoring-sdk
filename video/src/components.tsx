import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FONT, T} from './theme';

/** Fades the whole scene in over its first frames and out over its last. */
export const FadeInOut: React.FC<{
  duration: number;
  children: React.ReactNode;
}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 10, duration - 10, duration],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

/** Big kinetic caption. Pops in with a spring at `at`, leaves at `until`. */
export const Caption: React.FC<{
  at: number;
  until: number;
  children: React.ReactNode;
  size?: number;
  bottom?: number;
  color?: string;
}> = ({at, until, children, size = 54, bottom = 90, color = T.ink}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < at || frame > until) return null;

  const enter = spring({frame: frame - at, fps, config: {damping: 200, stiffness: 120}});
  const exit = interpolate(frame, [until - 8, until], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 30}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 650,
          color,
          textAlign: 'center',
          maxWidth: 1500,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Rounded card in the portal's visual language. */
export const Card: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({style, children}) => (
  <div
    style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 24,
      boxShadow: '0 12px 40px rgba(11,11,11,0.06)',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Phone mockup frame; children fill the screen area. */
export const PhoneFrame: React.FC<{
  width?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({width = 380, children, style}) => {
  const height = (width * 20) / 9;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.115,
        background: '#111',
        padding: width * 0.028,
        boxShadow: '0 24px 70px rgba(11,11,11,0.25)',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: width * 0.09,
          overflow: 'hidden',
          background: T.surface,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** SVG arrow that draws itself between two points, then sends a dot along. */
export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  drawAt: number;
  dotAt?: number;
  color?: string;
}> = ({x1, y1, x2, y2, drawAt, dotAt, color = T.baseline}) => {
  const frame = useCurrentFrame();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const progress = interpolate(frame, [drawAt, drawAt + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dotProgress =
    dotAt === undefined
      ? -1
      : interpolate(frame, [dotAt, dotAt + 26], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const dx = x1 + (x2 - x1) * dotProgress;
  const dy = y1 + (y2 - y1) * dotProgress;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 14;

  if (progress <= 0) return null;

  return (
    <svg
      style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      width="100%"
      height="100%"
    >
      <line
        x1={x1}
        y1={y1}
        x2={x1 + (x2 - x1) * progress}
        y2={y1 + (y2 - y1) * progress}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${len}`}
      />
      {progress >= 1 && (
        <polygon
          points={`${x2},${y2} ${x2 - headLength * Math.cos(angle - 0.45)},${
            y2 - headLength * Math.sin(angle - 0.45)
          } ${x2 - headLength * Math.cos(angle + 0.45)},${
            y2 - headLength * Math.sin(angle + 0.45)
          }`}
          fill={color}
        />
      )}
      {dotProgress > 0 && dotProgress < 1 && (
        <circle cx={dx} cy={dy} r={12} fill={T.blue} stroke={T.surface} strokeWidth={3} />
      )}
    </svg>
  );
};

/** Springs a child in at `at` (scale + rise). */
export const PopIn: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({at, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - at, fps, config: {damping: 14, stiffness: 120, mass: 0.7}});
  if (frame < at) return null;
  return (
    <div style={{...style, transform: `scale(${s}) ${style?.transform ?? ''}`, opacity: Math.min(1, s * 1.4)}}>
      {children}
    </div>
  );
};

/** Highlight ring that pulses around a rectangle region (absolute coords). */
export const HighlightRing: React.FC<{
  at: number;
  until: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}> = ({at, until, x, y, w, h, color = T.red}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > until) return null;
  const t = interpolate(frame, [at, at + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [until - 8, until], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 10,
        top: y - 10,
        width: w + 20,
        height: h + 20,
        border: `5px solid ${color}`,
        borderRadius: 18,
        opacity: t * exit,
        transform: `scale(${0.9 + t * 0.1})`,
        boxShadow: `0 0 0 6px ${T.surface}55`,
      }}
    />
  );
};
