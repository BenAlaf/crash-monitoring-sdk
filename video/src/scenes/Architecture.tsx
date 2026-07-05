import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Arrow, Caption, Card, FadeInOut, PopIn} from '../components';
import {FONT, MONO, T} from '../theme';

const DURATION = 720;

// stage coordinates (1920x1080); the caption band lives below y≈870
const PHONE = {x: 240, y: 250, w: 300, h: 380};
const SERVER = {x: 810, y: 290, w: 300, h: 300};
const ISSUE = {x: 1400, y: 270, w: 340, h: 330};

const Label: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: 26,
      fontWeight: 650,
      color: T.ink,
      textAlign: 'center',
      marginTop: 14,
    }}
  >
    {children}
  </div>
);

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  // crash flash on the phone
  const crashPulse = interpolate(frame, [70, 84, 120], [0, 1, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // report chip drops from phone into the disk tray
  const drop = interpolate(frame, [95, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // event chips converge into the issue card
  const converge = interpolate(frame, [430, 500], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const counter = Math.round(
    interpolate(frame, [510, 600], [1, 96], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const users = Math.round(
    interpolate(frame, [510, 600], [1, 32], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const chips = [0, 1, 2, 3, 4, 5];

  return (
    <FadeInOut duration={DURATION}>
      <AbsoluteFill style={{background: T.page}}>
        {/* ---- phone + disk queue ---- */}
        <PopIn at={5} style={{position: 'absolute', left: PHONE.x, top: PHONE.y}}>
          <Card style={{width: PHONE.w, height: PHONE.h, padding: 24, position: 'relative'}}>
            <div style={{height: 36, borderRadius: 10, background: T.blue, opacity: 0.9}} />
            {[150, 110, 170].map((w, i) => (
              <div key={i} style={{width: w, height: 13, borderRadius: 7, background: T.grid, marginTop: 20}} />
            ))}
            {/* crash flash */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 24,
                background: T.redWash,
                border: `4px solid ${T.red}`,
                opacity: crashPulse,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT,
                fontSize: 70,
                color: T.red,
                fontWeight: 800,
              }}
            >
              !
            </div>
          </Card>
          <Label>Your app</Label>
        </PopIn>

        {/* disk tray first, then the chip drops on top of it */}
        <PopIn at={125} style={{position: 'absolute', left: PHONE.x + 35, top: PHONE.y + PHONE.h + 118}}>
          <div
            style={{
              width: PHONE.w - 70,
              padding: '14px 0 34px',
              borderRadius: 14,
              background: T.surface,
              border: `2px dashed ${T.baseline}`,
              textAlign: 'center',
              fontFamily: FONT,
              fontSize: 22,
              fontWeight: 600,
              color: T.ink2,
            }}
          >
            💾 disk queue
          </div>
        </PopIn>
        {drop > 0 && (
          <div
            style={{
              position: 'absolute',
              left: PHONE.x + PHONE.w / 2 - 62,
              top: PHONE.y + PHONE.h - 40 + drop * 200,
              width: 124,
              padding: '8px 0',
              textAlign: 'center',
              borderRadius: 12,
              background: T.surface,
              border: `2px solid ${T.red}`,
              fontFamily: MONO,
              fontSize: 19,
              color: T.ink2,
              boxShadow: '0 8px 22px rgba(11,11,11,0.10)',
              zIndex: 3,
            }}
          >
            crash.json
          </div>
        )}

        {/* ---- arrows ---- */}
        <Arrow
          x1={PHONE.x + PHONE.w + 24}
          y1={PHONE.y + PHONE.h / 2}
          x2={SERVER.x - 24}
          y2={SERVER.y + SERVER.h / 2}
          drawAt={265}
          dotAt={300}
        />
        <Arrow
          x1={SERVER.x + SERVER.w + 24}
          y1={SERVER.y + SERVER.h / 2}
          x2={ISSUE.x - 24}
          y2={ISSUE.y + ISSUE.h / 2}
          drawAt={410}
        />

        {/* ---- server ---- */}
        <PopIn at={250} style={{position: 'absolute', left: SERVER.x, top: SERVER.y}}>
          <Card
            style={{
              width: SERVER.w,
              height: SERVER.h,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            <div style={{fontSize: 64}}>☁️</div>
            <div style={{fontFamily: FONT, fontSize: 26, fontWeight: 650, color: T.ink}}>
              CrashMonitor API
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 19,
                color: T.blue,
                background: T.blueWash,
                padding: '6px 14px',
                borderRadius: 10,
                opacity: frame >= 390 ? 1 : 0,
              }}
            >
              sha256(type + frames)
            </div>
          </Card>
          <Label>fingerprints every report</Label>
        </PopIn>

        {/* ---- events converge into one issue ---- */}
        {chips.map((i) => {
          const startX = SERVER.x + SERVER.w - 40;
          const startY = SERVER.y + 40 + i * 45;
          const endX = ISSUE.x + ISSUE.w / 2 - 20;
          const endY = ISSUE.y + ISSUE.h / 2 - 20;
          const x = startX + (endX - startX) * converge;
          const y = startY + (endY - startY) * converge;
          if (frame < 430 || converge >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 40,
                height: 40,
                borderRadius: 10,
                background: i % 2 ? T.redWash : T.blueWash,
                border: `2px solid ${i % 2 ? T.red : T.blue}`,
                opacity: 1 - converge * 0.5,
              }}
            />
          );
        })}

        <PopIn at={495} style={{position: 'absolute', left: ISSUE.x, top: ISSUE.y}}>
          <Card style={{width: ISSUE.w, height: ISSUE.h, padding: 28}}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: T.redWash,
                color: T.red,
                borderRadius: 999,
                padding: '4px 14px',
                fontFamily: FONT,
                fontSize: 19,
                fontWeight: 650,
              }}
            >
              ● crash
            </div>
            <div style={{fontFamily: FONT, fontSize: 27, fontWeight: 700, color: T.ink, marginTop: 16}}>
              NullPointerException
            </div>
            <div style={{fontFamily: MONO, fontSize: 20, color: T.ink2, marginTop: 6}}>
              ProfileActivity#renderUser
            </div>
            <div style={{display: 'flex', gap: 34, marginTop: 30}}>
              <div>
                <div style={{fontFamily: FONT, fontSize: 46, fontWeight: 700, color: T.ink}}>{counter}</div>
                <div style={{fontFamily: FONT, fontSize: 20, color: T.muted}}>events</div>
              </div>
              <div>
                <div style={{fontFamily: FONT, fontSize: 46, fontWeight: 700, color: T.ink}}>{users}</div>
                <div style={{fontFamily: FONT, fontSize: 20, color: T.muted}}>users</div>
              </div>
            </div>
          </Card>
          <Label>one issue</Label>
        </PopIn>

        {/* ---- captions ---- */}
        <Caption at={40} until={250} size={50}>
          Every crash is saved to disk — <span style={{color: T.red}}>before the process dies.</span>
        </Caption>
        <Caption at={258} until={420} size={50}>
          Uploaded on the next launch. Offline? It waits.
        </Caption>
        <Caption at={428} until={560} size={50}>
          Grouped by fingerprint, server-side.
        </Caption>
        <Caption at={568} until={DURATION - 8} size={58}>
          One bug = <span style={{color: T.blue}}>one issue.</span> Not a thousand rows.
        </Caption>
      </AbsoluteFill>
    </FadeInOut>
  );
};

export const ARCHITECTURE_DURATION = DURATION;
