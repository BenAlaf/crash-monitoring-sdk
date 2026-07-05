import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Caption, FadeInOut} from '../components';
import {FONT, MONO, T} from '../theme';

const DURATION = 300;

const LINE_1 = 'implementation("com.github.BenAlaf:crash-monitoring-sdk:1.0.0")';
const LINE_2A = 'CrashMonitor.init(this,';
const LINE_2B = '    CrashMonitorConfig.Builder("your-api-key").build())';

/** Types text on, character by character, starting at `at`. */
const TypeOn: React.FC<{text: string; at: number; color?: string}> = ({
  text,
  at,
  color = T.codeInk,
}) => {
  const frame = useCurrentFrame();
  const chars = Math.round(
    interpolate(frame, [at, at + text.length * 0.8], [0, text.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return (
    <div style={{fontFamily: MONO, fontSize: 30, color, whiteSpace: 'pre', lineHeight: 1.7}}>
      {text.slice(0, chars)}
      {chars > 0 && chars < text.length && (
        <span style={{borderRight: `3px solid ${T.blue}`}} />
      )}
    </div>
  );
};

export const CodeScene: React.FC = () => {
  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: 1380, transform: 'translateY(-50px)'}}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 24,
              fontWeight: 600,
              color: T.muted,
              marginBottom: 10,
              marginLeft: 6,
            }}
          >
            build.gradle.kts
          </div>
          <div
            style={{
              background: T.codeBg,
              borderRadius: 18,
              padding: '30px 40px',
              boxShadow: '0 24px 70px rgba(11,11,11,0.25)',
            }}
          >
            <TypeOn text={LINE_1} at={15} />
          </div>

          <div
            style={{
              fontFamily: FONT,
              fontSize: 24,
              fontWeight: 600,
              color: T.muted,
              margin: '26px 0 10px 6px',
            }}
          >
            Application.onCreate()
          </div>
          <div
            style={{
              background: T.codeBg,
              borderRadius: 18,
              padding: '30px 40px',
              boxShadow: '0 24px 70px rgba(11,11,11,0.25)',
            }}
          >
            <TypeOn text={LINE_2A} at={95} />
            <TypeOn text={LINE_2B} at={120} />
          </div>
        </div>

        <Caption at={175} until={DURATION - 8} size={54}>
          One dependency. <span style={{color: T.blue}}>Two lines of code.</span>
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const CODE_DURATION = DURATION;
