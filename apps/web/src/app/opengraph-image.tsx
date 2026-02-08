import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        background:
          'linear-gradient(135deg, #1a1612 0%, #2a241c 45%, #0f0d0b 100%)',
        color: '#f5efe5',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-1px' }}>
        SkillBound
      </div>
      <div style={{ fontSize: 34, marginTop: 16, color: '#d8c7a8' }}>
        OSRS Progression Tracker + Grand Exchange Flipping Tool
      </div>
      <div style={{ fontSize: 24, marginTop: 28, color: '#b9a98d' }}>
        Progression • Grand Exchange • Flipping
      </div>
    </div>,
    size
  );
}
