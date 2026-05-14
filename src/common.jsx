// Common interactive primitives reused across all three design directions.
// Volume slider with haptic-feeling drag, AnimatedWaveform, AlbumArt with
// fallback gradients, and a small ScrubBar with seek.

const { useState: _u, useEffect: _e, useRef: _r, useCallback: _c, useMemo: _m } = React;

// ── AlbumArt ────────────────────────────────────────────────────────────
// Renders the procedural gradient + a subtle overlay shimmer + the
// album/playlist title baked in as a kerned label (so the surface feels
// like a real cover, not an empty rectangle).
function AlbumArt({ art, title, subtitle, size, radius = 14, style }) {
  if (!art) {
    return <div style={{ width: size, height: size, borderRadius: radius, background: '#222', ...style }} />;
  }
  // A subtle inner ring + corner glow built from the dominant color.
  const ring = `inset 0 0 0 0.5px rgba(255,255,255,.18), inset 0 1px 0 rgba(255,255,255,.16)`;
  return (
    <div className="album-art" style={{
      width: size, height: size, borderRadius: radius,
      background: art.bg, position: 'relative', overflow: 'hidden',
      boxShadow: ring,
      flex: '0 0 auto',
      ...style,
    }}>
      {/* Soft top-right highlight */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 75% 15%, rgba(255,255,255,.22), transparent 55%)',
        pointerEvents: 'none',
      }} />
      {/* Title typography baked into the art */}
      <div style={{
        position: 'absolute', left: '8%', right: '8%', bottom: '10%',
        color: 'rgba(255,255,255,.94)',
        textShadow: '0 1px 12px rgba(0,0,0,.25)',
        fontFamily: 'var(--font-display)',
      }}>
        <div style={{
          fontSize: Math.max(11, size * 0.085),
          fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em',
          textWrap: 'balance',
        }}>{title}</div>
        {subtitle && <div style={{
          fontSize: Math.max(9, size * 0.055), marginTop: 4,
          opacity: 0.75, letterSpacing: '0.04em', textTransform: 'uppercase',
          fontWeight: 500,
        }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── VolumeSlider ────────────────────────────────────────────────────────
// Tap or drag a thumb-less track to set volume. The track itself fills —
// minimalist, iOS-y. Pointer events so it works on touch and mouse.
function VolumeSlider({ value, onChange, height = 6, accent = '#fff', track = 'rgba(255,255,255,.15)', radius, onCommit }) {
  const ref = _r(null);
  const drag = _r({ active: false });

  const update = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const v = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onChange(Math.round(v));
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    drag.current.active = true;
    ref.current.setPointerCapture?.(e.pointerId);
    update(e);
  };
  const onPointerMove = (e) => { if (drag.current.active) update(e); };
  const onPointerUp = (e) => {
    if (drag.current.active) onCommit?.();
    drag.current.active = false;
    ref.current?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative', height, background: track,
        borderRadius: radius ?? height,
        cursor: 'pointer', touchAction: 'none',
        overflow: 'hidden',
      }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${value}%`, background: accent,
        transition: drag.current.active ? 'none' : 'width 120ms cubic-bezier(.2,.7,.3,1)',
      }} />
    </div>
  );
}

// ── AnimatedWaveform ────────────────────────────────────────────────────
// Tiny equalizer bars that pulse when "playing", flatline when paused.
function AnimatedWaveform({ playing, color = 'currentColor', bars = 4, height = 14, width = 18 }) {
  // Use CSS animations so we don't burn render cycles.
  const id = _m(() => 'wf-' + Math.random().toString(36).slice(2, 8), []);
  const css = `
    @keyframes ${id}-a { 0%,100%{transform:scaleY(.25)} 50%{transform:scaleY(1)} }
    @keyframes ${id}-b { 0%,100%{transform:scaleY(.5)}  50%{transform:scaleY(.7)} }
    @keyframes ${id}-c { 0%,100%{transform:scaleY(.4)}  50%{transform:scaleY(.95)} }
    @keyframes ${id}-d { 0%,100%{transform:scaleY(.7)}  50%{transform:scaleY(.35)} }
  `;
  const anims = [`${id}-a`, `${id}-b`, `${id}-c`, `${id}-d`];
  const dur   = ['900ms','620ms','780ms','520ms'];
  return (
    <>
      <style>{css}</style>
      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height, width, verticalAlign: 'middle' }}>
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} style={{
            flex: 1, background: color, borderRadius: 1,
            height: '100%', transformOrigin: 'bottom',
            animation: playing ? `${anims[i % 4]} ${dur[i % 4]} ease-in-out infinite` : 'none',
            transform: playing ? undefined : 'scaleY(.25)',
            transition: 'transform 200ms',
          }} />
        ))}
      </div>
    </>
  );
}

// ── ScrubBar ────────────────────────────────────────────────────────────
// Track progress with seek + elapsed/remaining labels.
function ScrubBar({ value, max, onSeek, color = '#fff', track = 'rgba(255,255,255,.15)', showLabels = true, mono = 'ui-monospace, "SF Mono", Menlo, monospace' }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
      <VolumeSlider value={pct} onChange={(v) => onSeek((v / 100) * max)} height={3} accent={color} track={track} />
      {showLabels && (
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontFamily: mono, fontSize: 11,
                      opacity: 0.55, letterSpacing: '0.04em' }}>
          <span>{formatTime(value)}</span>
          <span>-{formatTime(max - value)}</span>
        </div>
      )}
    </div>
  );
}

// ── QueueSheet — pull-up bottom sheet used by Obsidian + Aether ─────────
function QueueSheet({ open, onClose, theme = 'dark' }) {
  const s = useSonos();
  const q = s.queue;
  const Tracks = DATA.tracks;
  const dark = theme === 'dark';
  const c = {
    bg: dark ? 'rgba(20,20,22,.92)' : 'rgba(252,252,253,.85)',
    border: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    text: dark ? '#fff' : '#111',
    sub: dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.5)',
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: open ? 'rgba(0,0,0,.32)' : 'transparent',
        backdropFilter: open ? 'blur(4px)' : 'none',
        transition: 'background 240ms, backdrop-filter 240ms',
      }} />
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 12,
        height: '72%',
        background: c.bg,
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: `0.5px solid ${c.border}`,
        borderRadius: 22, color: c.text,
        boxShadow: '0 24px 80px rgba(0,0,0,.45)',
        transform: open ? 'translateY(0)' : 'translateY(105%)',
        transition: 'transform 360ms cubic-bezier(.2,.85,.25,1)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: c.border, position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 8 }} />
          <h3 style={{ margin: '8px 0 0', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Up Next</h3>
          <button onClick={onClose} style={{
            border: 0, background: 'transparent', color: c.sub, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
          }}>
            <Icons.Close size={16} /> Close
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px 16px' }}>
          {q.map((tid, i) => {
            const t = Tracks.find((x) => x.id === tid);
            if (!t) return null;
            const isCurrent = i === s.queueIndex;
            return (
              <div key={tid + i} style={{
                display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12,
                alignItems: 'center', padding: '8px 12px',
                borderRadius: 12,
                background: isCurrent ? (dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)') : 'transparent',
              }}>
                <AlbumArt art={t.art} title={t.album} size={44} radius={8} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 540, fontSize: 14, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                    {isCurrent && <AnimatedWaveform playing={true} color={c.text} height={10} width={14} style={{ marginLeft: 8 }} />}
                  </div>
                  <div style={{ color: c.sub, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist} · {t.album}</div>
                </div>
                <div style={{ color: c.sub, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{formatTime(t.duration)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AlbumArt, VolumeSlider, AnimatedWaveform, ScrubBar, QueueSheet,
});
