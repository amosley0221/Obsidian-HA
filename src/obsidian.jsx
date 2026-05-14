// OBSIDIAN — desktop / tablet
// Deep cinematic dark (or airy light). The background halo + accent color
// are derived from the currently-playing track's album art, so the whole
// UI tints to whatever's on.

function Obsidian({ theme = 'dark', bgStyle = 'halo', onThemeToggle }) {
  const s = useSonos();
  const active = sel.activeRoom(s);
  const track = sel.trackFor(s, s.activeRoomId);
  const phead = s.playhead[s.activeRoomId] || 0;
  const [queueOpen, setQueueOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [section, setSection] = useState('listen-now');
  const [expanded, setExpanded] = useState(false);

  const dark = theme === 'dark';
  const tk = dark ? OBS_TOKENS.dark : OBS_TOKENS.light;
  const trackAcc = trackAccent(track, dark);

  const glow = track?.art?.dominant || (dark ? 'oklch(0.48 0.10 250)' : 'oklch(0.78 0.10 250)');
  const shadow = track?.art?.shadow || (dark ? 'oklch(0.28 0.10 250)' : 'oklch(0.62 0.10 250)');

  return (
    <div className="obsidian" style={{
      position: 'absolute', inset: 0,
      background: tk.bg, color: tk.text,
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
      letterSpacing: '-0.005em',
      // theme tokens
      '--obs-text': tk.text, '--obs-text2': tk.text2, '--obs-text3': tk.text3,
      '--obs-surface': tk.surface, '--obs-surface-strong': tk.surfaceStrong,
      '--obs-border': tk.border, '--obs-track': tk.track,
      '--obs-invert-bg': tk.invertBg, '--obs-invert-text': tk.invertText,
      // accent: auto from album art, overridable by --tw-accent
      '--obs-accent': `var(--tw-accent, ${trackAcc})`,
      // tweakables
      '--obs-radius-sm': 'calc(var(--tw-radius, 16px) * 0.6)',
      '--obs-radius':    'var(--tw-radius, 16px)',
      '--obs-radius-lg': 'calc(var(--tw-radius, 16px) * 1.5)',
      '--obs-pad':       'var(--tw-pad, 20px)',
      '--obs-gap':       'var(--tw-gap, 18px)',
    }}>
      {/* Halo / blurred-art / solid background */}
      {bgStyle !== 'solid' && (
        <ObsidianBackdrop track={track} glow={glow} shadow={shadow} tk={tk} mode={bgStyle} />
      )}

      <ObsidianTopbar onQueue={() => setQueueOpen(true)} onSearch={() => setSearchOpen(true)} tk={tk} theme={theme} onThemeToggle={onThemeToggle} />

      <div style={{
        position: 'absolute', inset: '56px var(--obs-pad) var(--obs-pad)',
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr) minmax(300px, 340px)',
        gap: 'var(--obs-gap)',
        minHeight: 0,
      }}>
        <ObsidianRooms tk={tk} />
        <ObsidianHero track={track} phead={phead} active={active} onExpand={() => setExpanded(true)} tk={tk} />
        <ObsidianLibrary section={section} setSection={setSection} tk={tk} />
      </div>

      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} theme={dark ? 'dark' : 'light'} />
      {searchOpen && <SearchOverlay tk={tk} onClose={() => setSearchOpen(false)} />}
      {expanded && <ObsidianFullscreen track={track} phead={phead} active={active} onClose={() => setExpanded(false)} tk={tk} />}
    </div>
  );
}

// ─── Tokens ─────────────────────────────────────────────────────────────
const OBS_TOKENS = {
  dark: {
    bg: '#000', text: '#fff',
    text2: 'rgba(255,255,255,.62)', text3: 'rgba(255,255,255,.42)',
    surface: 'rgba(255,255,255,.06)',
    surfaceStrong: 'rgba(255,255,255,.12)',
    border: 'rgba(255,255,255,.10)',
    track: 'rgba(255,255,255,.12)',
    invertBg: '#fff', invertText: '#000',
    haloOpacity: 0.55, haloBlur: 80,
    panelBg: 'rgba(20,20,22,.55)',
    grain: 0.04,
    isDark: true,
  },
  light: {
    bg: '#f4f3ef', text: '#1a1a1c',
    text2: 'rgba(26,26,28,.62)', text3: 'rgba(26,26,28,.42)',
    surface: 'rgba(255,255,255,.55)',
    surfaceStrong: 'rgba(255,255,255,.82)',
    border: 'rgba(0,0,0,.07)',
    track: 'rgba(0,0,0,.08)',
    invertBg: '#1a1a1c', invertText: '#fff',
    haloOpacity: 0.45, haloBlur: 60,
    panelBg: 'rgba(255,255,255,.55)',
    grain: 0.02,
    isDark: false,
  },
};

// Compute an accent color from a track's dominant hue, tuned for legibility
// against the current theme background.
function trackAccent(track, dark) {
  const hue = track?.art?.hue;
  if (hue == null) return dark ? '#ff7e60' : '#c8482e';
  // Dark: bright accent. Light: deeper saturated accent.
  return dark
    ? `oklch(0.76 0.17 ${hue})`
    : `oklch(0.48 0.18 ${hue})`;
}

// ─── Backdrop (halo or blurred-art) ─────────────────────────────────────
function ObsidianBackdrop({ track, glow, shadow, tk, mode }) {
  if (mode === 'art' && track) {
    return (
      <>
        <div style={{
          position: 'absolute', inset: -40, pointerEvents: 'none',
          background: track.art.bg, filter: 'blur(80px) saturate(140%)',
          opacity: tk.isDark ? 0.45 : 0.32,
          transition: 'background 600ms ease',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: tk.isDark
            ? 'linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,.65))'
            : 'linear-gradient(to bottom, rgba(244,243,239,.35), rgba(244,243,239,.7))',
        }} />
      </>
    );
  }
  return (
    <>
      <div style={{
        position: 'absolute', inset: -120, pointerEvents: 'none',
        background: `
          radial-gradient(60% 50% at 30% 25%, ${glow} 0%, transparent 60%),
          radial-gradient(45% 40% at 80% 80%, ${shadow} 0%, transparent 65%)
        `,
        filter: `blur(${tk.haloBlur}px) saturate(120%)`,
        opacity: tk.haloOpacity,
        transition: 'background 600ms ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: tk.grain,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
      }} />
    </>
  );
}

// ─── Topbar ─────────────────────────────────────────────────────────────
function ObsidianTopbar({ onQueue, onSearch, tk, theme, onThemeToggle }) {
  const s = useSonos();
  const groupSize = sel.groupedWith(s, s.activeRoomId).length;
  const room = DATA.rooms.find((r) => r.id === s.activeRoomId);
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 56,
      padding: '0 var(--obs-pad)',
      display: 'flex', alignItems: 'center', gap: 12,
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, var(--obs-accent), color-mix(in oklab, var(--obs-accent) 50%, ${tk.isDark ? '#000' : '#fff'}))`,
          display: 'grid', placeItems: 'center', color: tk.isDark ? '#000' : '#fff', fontWeight: 700, fontSize: 14,
        }}>◐</div>
        <div style={{ fontWeight: 600, letterSpacing: '-0.01em', fontSize: 15, whiteSpace: 'nowrap' }}>Speakers</div>
        <div style={{ opacity: 0.4, fontSize: 13, whiteSpace: 'nowrap' }}>· Home</div>
      </div>

      <button onClick={onSearch} style={{
        flex: '1 1 auto', minWidth: 0, maxWidth: 380,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', height: 34, boxSizing: 'border-box',
        background: tk.surface,
        border: `0.5px solid ${tk.border}`,
        borderRadius: 999, fontSize: 13,
        color: tk.text, cursor: 'pointer', textAlign: 'left',
      }}>
        <Icons.Search size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search Apple Music…</span>
        <span style={{
          flexShrink: 0, padding: '1px 5px', borderRadius: 4,
          border: `0.5px solid ${tk.border}`, fontSize: 10.5,
          color: tk.text3, fontFamily: 'var(--font-mono)',
        }}>⌘K</span>
      </button>

      <button style={topBtn(tk)}>
        <Icons.AirPlay size={16} />
        <span style={{ whiteSpace: 'nowrap' }}>{room?.name}</span>
        {groupSize > 1 && <span style={{
          fontSize: 11, padding: '2px 6px', borderRadius: 999,
          background: 'var(--obs-accent)', color: tk.isDark ? '#0a0a0a' : '#fff', fontWeight: 600,
        }}>+{groupSize - 1}</span>}
      </button>
      <button style={topBtn(tk)} onClick={onQueue}><Icons.Queue size={16} /><span style={{ whiteSpace: 'nowrap' }}>Up Next</span></button>
      {onThemeToggle && (
        <button onClick={onThemeToggle}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                style={{ ...topBtn(tk), width: 34, padding: 0, justifyContent: 'center', fontSize: 14 }}>
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      )}
      <button style={{ ...topBtn(tk), width: 34, padding: 0, justifyContent: 'center' }}><Icons.More size={16} /></button>
    </div>
  );
}

const topBtn = (tk) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '0 12px', height: 34, flexShrink: 0,
  background: tk.surface,
  border: `0.5px solid ${tk.border}`,
  color: tk.text, fontSize: 12.5, fontWeight: 500,
  borderRadius: 999, cursor: 'pointer',
  whiteSpace: 'nowrap',
});

// ─── Rooms column ───────────────────────────────────────────────────────
function ObsidianRooms({ tk }) {
  const s = useSonos();
  const [dragRoom, setDragRoom] = useState(null);
  const [hoverRoom, setHoverRoom] = useState(null);

  const groups = useMemo(() => {
    const out = []; const byGroup = new Map();
    for (const r of DATA.rooms) {
      const gid = s.rooms[r.id].groupId;
      if (gid) {
        if (!byGroup.has(gid)) { const arr = []; byGroup.set(gid, arr); out.push({ groupId: gid, rooms: arr }); }
        byGroup.get(gid).push(r);
      } else {
        out.push({ groupId: null, rooms: [r] });
      }
    }
    return out;
  }, [s.rooms]);

  return (
    <div style={panel(tk)}>
      <PanelHeader tk={tk} title={`Rooms · ${DATA.rooms.length}`}
                   trailing={<button style={ghostBtn(tk)}><Icons.Plus size={14} /> Group</button>} />
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{
            position: 'relative',
            padding: g.groupId ? '4px 4px 6px' : 0,
            background: g.groupId ? tk.surface : 'transparent',
            border: g.groupId ? `0.5px solid ${tk.border}` : '0',
            borderRadius: g.groupId ? 'var(--obs-radius)' : 0,
          }}>
            {g.groupId && (
              <div style={{
                padding: '6px 10px 6px', fontSize: 10,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--obs-accent)', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icons.Group size={11} /> Grouped · {g.rooms.length} rooms
                </span>
                <button onClick={() => g.rooms.forEach((r) => SonosActions.ungroup(r.id))} style={{
                  border: 0, background: 'transparent', color: tk.text3,
                  fontSize: 10.5, fontWeight: 500, cursor: 'pointer', letterSpacing: 0, textTransform: 'none',
                }}>Ungroup</button>
              </div>
            )}
            {g.rooms.map((r) => (
              <RoomCard
                key={r.id} tk={tk}
                room={r}
                state={s.rooms[r.id]}
                active={s.activeRoomId === r.id}
                hovered={hoverRoom === r.id && dragRoom && dragRoom !== r.id}
                onClick={() => SonosActions.setActiveRoom(r.id)}
                onPlayToggle={() => SonosActions.togglePlayRoom(r.id)}
                onVolume={(v) => SonosActions.setVolume(r.id, v)}
                onDragStart={() => setDragRoom(r.id)}
                onDragEnd={() => {
                  if (dragRoom && hoverRoom && dragRoom !== hoverRoom) {
                    SonosActions.groupRooms(hoverRoom, dragRoom);
                  }
                  setDragRoom(null); setHoverRoom(null);
                }}
                onDragOver={() => setHoverRoom(r.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomCard({ room, state, active, hovered, tk, onClick, onPlayToggle, onVolume, onDragStart, onDragEnd, onDragOver }) {
  const track = state.trackId ? DATA.tracks.find((t) => t.id === state.trackId) : null;
  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      onDragEnter={onDragOver}
      onDragOver={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        padding: '10px 10px 10px',
        background: active ? tk.surfaceStrong : 'transparent',
        borderRadius: 'var(--obs-radius-sm)',
        cursor: 'pointer', transition: 'background 180ms',
        boxShadow: hovered ? '0 0 0 1.5px var(--obs-accent), 0 0 0 5px color-mix(in oklab, var(--obs-accent) 22%, transparent)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: track?.art?.bg || tk.surfaceStrong,
          display: 'grid', placeItems: 'center',
          color: tk.text, flex: '0 0 auto',
          boxShadow: track ? `0 4px 12px -2px ${track.art.shadow}` : 'none',
        }}>
          {!track && <RoomIcon id={room.icon} size={16} stroke={1.5} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 540, letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>{room.name}</span>
            {state.playing && <span style={{ flexShrink: 0 }}><AnimatedWaveform playing color="var(--obs-accent)" height={10} width={12} bars={3} /></span>}
          </div>
          <div style={{ fontSize: 11, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {track ? `${track.title} · ${track.artist}` : `${room.product} · idle`}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onPlayToggle(); }} style={{
          width: 30, height: 30, borderRadius: 999,
          border: 0, background: state.playing ? tk.invertBg : tk.surfaceStrong,
          color: state.playing ? tk.invertText : tk.text, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          {state.playing ? <Icons.Pause size={13} /> : <Icons.Play size={13} />}
        </button>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.VolMin size={14} style={{ opacity: 0.5 }} />
        <div style={{ flex: 1 }}>
          <VolumeSlider value={state.volume} onChange={(v) => onVolume(v)} accent={tk.text} track={tk.track} />
        </div>
        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', opacity: 0.55, width: 22, textAlign: 'right' }}>{state.volume}</span>
      </div>
    </div>
  );
}

// ─── Hero / Now Playing ─────────────────────────────────────────────────
function ObsidianHero({ track, phead, active, tk, onExpand }) {
  const s = useSonos();
  const fav = s.favorites.has(track?.id);
  if (!track) {
    return (
      <div style={{ ...panel(tk), alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
        <div style={{ width: 88, height: 88, borderRadius: 999,
                      background: tk.surface, display: 'grid', placeItems: 'center',
                      border: `0.5px solid ${tk.border}` }}>
          <Icons.Speaker size={36} />
        </div>
        <div style={{ marginTop: 16, fontSize: 17, fontWeight: 600 }}>Nothing playing here</div>
        <div style={{ marginTop: 4, fontSize: 13, color: tk.text2 }}>Choose something from your library</div>
      </div>
    );
  }
  return (
    <div style={{
      ...panel(tk),
      padding: 28,
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      gap: 22,
    }}>
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <div onClick={onExpand} style={{ cursor: 'zoom-in', position: 'relative' }}>
          <AlbumArt art={track.art} title={track.album} subtitle={track.artist}
                    size={400} radius={22}
                    style={{ boxShadow: `0 30px 80px -20px ${track.art.shadow}, 0 0 0 .5px ${tk.border}` }} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
                          color: 'var(--obs-accent)', marginBottom: 8 }}>
              Now Playing · {DATA.rooms.find((r) => r.id === s.activeRoomId)?.name}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1,
                          fontFamily: 'var(--font-display)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.title}
            </div>
            <div style={{ marginTop: 6, fontSize: 15, color: tk.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.artist} · <span style={{ opacity: 0.75 }}>{track.album}</span>
            </div>
          </div>
          <button onClick={() => SonosActions.toggleFavorite(track.id)} style={{
            border: 0, background: 'transparent', color: fav ? 'var(--obs-accent)' : tk.text, cursor: 'pointer',
            opacity: fav ? 1 : 0.6,
          }}>
            {fav ? <Icons.HeartFill size={22} /> : <Icons.Heart size={22} />}
          </button>
        </div>

        <div style={{ marginTop: 22 }}>
          <ScrubBar value={phead} max={track.duration} onSeek={(v) => SonosActions.seek(s.activeRoomId, v)} color={tk.text} track={tk.track} />
        </div>

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button style={iconBtn(36, tk)}><Icons.Shuffle size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={iconBtn(42, tk)} onClick={() => SonosActions.prevTrack()}><Icons.Prev size={20} /></button>
            <button onClick={() => SonosActions.togglePlayRoom(s.activeRoomId)} style={{
              width: 64, height: 64, borderRadius: 999, border: 0,
              background: tk.invertBg, color: tk.invertText, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              boxShadow: tk.isDark
                ? '0 10px 30px rgba(255,255,255,.18), 0 0 0 .5px rgba(0,0,0,.2)'
                : '0 12px 24px rgba(0,0,0,.18)',
            }}>
              {active.playing ? <Icons.Pause size={28} /> : <Icons.Play size={28} style={{ marginLeft: 3 }} />}
            </button>
            <button style={iconBtn(42, tk)} onClick={() => SonosActions.nextTrack()}><Icons.Next size={20} /></button>
          </div>
          <button style={iconBtn(36, tk)}><Icons.Repeat size={18} /></button>
        </div>
      </div>
    </div>
  );
}

const iconBtn = (size, tk) => ({
  width: size, height: size, borderRadius: 999, border: 0,
  background: tk.surface, color: tk.text, cursor: 'pointer',
  display: 'grid', placeItems: 'center',
  transition: 'background 160ms, transform 120ms',
});

const ghostBtn = (tk) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', border: `0.5px solid ${tk.border}`,
  borderRadius: 999, background: 'transparent', color: tk.text,
  fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
});

// ─── Library column ────────────────────────────────────────────────────
const LIB_SECTIONS = [
  { id: 'listen-now', label: 'Listen Now' },
  { id: 'tracks',     label: 'Tracks' },
  { id: 'playlists',  label: 'Playlists' },
  { id: 'albums',     label: 'Albums' },
  { id: 'artists',    label: 'Artists' },
  { id: 'radio',      label: 'Radio' },
];

function ObsidianLibrary({ section, setSection, tk }) {
  const s = useSonos();
  const items = useMemo(() => {
    const map = (arr) => (arr || []).map((it) => ({
      id: it.id, title: it.title, subtitle: it.artist || it.subtitle || '', art: it.art,
    }));
    switch (section) {
      case 'listen-now': return map((DATA.recents || []).slice(0, 8));
      case 'tracks':     return map(DATA.libraryTracks || []);
      case 'playlists':  return map(DATA.playlists || []);
      case 'albums':     return map(DATA.albums || []);
      case 'artists':    return map(DATA.artists || []);
      case 'radio':      return map(DATA.stations || []);
      default:           return [];
    }
  }, [section, s]); // re-eval when store updates (libraries populated async)

  return (
    <div style={panel(tk)}>
      <div style={{ padding: '16px 16px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--obs-accent)', whiteSpace: 'nowrap' }}>
            Apple Music
          </div>
          <button style={{ ...ghostBtn(tk), padding: '3px 8px' }}><Icons.Search size={11} /></button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {LIB_SECTIONS.map((sec) => (
            <button key={sec.id} onClick={() => setSection(sec.id)} style={{
              padding: '5px 9px', fontSize: 11.5, fontWeight: 500,
              borderRadius: 999, border: 0, cursor: 'pointer',
              background: section === sec.id ? tk.surfaceStrong : 'transparent',
              color: section === sec.id ? tk.text : tk.text2,
              whiteSpace: 'nowrap',
            }}>{sec.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 14px 14px' }}>
        {items.map((it) => (
          <button key={it.id} onClick={() => SonosActions.playTrack(it.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '8px', border: 0, background: 'transparent',
            color: tk.text, cursor: 'pointer', borderRadius: 12,
            textAlign: 'left',
          }}>
            <AlbumArt art={it.art} title={it.title} size={48} radius={10} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>{it.title}</div>
              <div style={{ fontSize: 11.5, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subtitle}</div>
            </div>
            <Icons.Play size={14} style={{ opacity: 0.5 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Fullscreen player overlay ─────────────────────────────────────────
function ObsidianFullscreen({ track, phead, active, tk, onClose }) {
  const s = useSonos();
  if (!track) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: tk.isDark ? 'rgba(0,0,0,.65)' : 'rgba(244,243,239,.55)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      display: 'grid', placeItems: 'center',
      animation: 'obs-fade 240ms ease',
    }}>
      <style>{`@keyframes obs-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 560, padding: 36, borderRadius: 24,
        background: tk.isDark ? 'rgba(20,20,22,.85)' : 'rgba(255,255,255,.88)',
        border: `0.5px solid ${tk.border}`,
        boxShadow: '0 30px 120px rgba(0,0,0,.4)',
      }}>
        <button onClick={onClose} style={{ ...iconBtn(34, tk), float: 'right' }}><Icons.Down size={18} /></button>
        <AlbumArt art={track.art} title={track.album} subtitle={track.artist} size={488} radius={22}
                  style={{ boxShadow: `0 40px 120px -30px ${track.art.shadow}` }} />
        <div style={{ marginTop: 28, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>{track.title}</div>
        <div style={{ marginTop: 4, fontSize: 15, color: tk.text2 }}>{track.artist} · {track.album}</div>
        <div style={{ marginTop: 22 }}>
          <ScrubBar value={phead} max={track.duration} onSeek={(v) => SonosActions.seek(s.activeRoomId, v)} color={tk.text} track={tk.track} />
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <button style={iconBtn(44, tk)} onClick={() => SonosActions.prevTrack()}><Icons.Prev size={20} /></button>
          <button onClick={() => SonosActions.togglePlayRoom(s.activeRoomId)} style={{
            width: 68, height: 68, borderRadius: 999, border: 0,
            background: tk.invertBg, color: tk.invertText, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            {active.playing ? <Icons.Pause size={28} /> : <Icons.Play size={28} style={{ marginLeft: 3 }} />}
          </button>
          <button style={iconBtn(44, tk)} onClick={() => SonosActions.nextTrack()}><Icons.Next size={20} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Building blocks ───────────────────────────────────────────────────
function panel(tk, extra) {
  return {
    position: 'relative', minWidth: 0, minHeight: 0,
    display: 'flex', flexDirection: 'column',
    background: tk.panelBg,
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: `0.5px solid ${tk.border}`,
    borderRadius: 'var(--obs-radius-lg)',
    boxShadow: tk.isDark
      ? '0 1px 0 rgba(255,255,255,.04) inset, 0 30px 60px -20px rgba(0,0,0,.5)'
      : '0 1px 0 rgba(255,255,255,.7) inset, 0 20px 40px -20px rgba(0,0,0,.12)',
    overflow: 'hidden',
    ...extra,
  };
}

function PanelHeader({ title, trailing, tk }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 16px 8px', gap: 8,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: tk.text3, whiteSpace: 'nowrap' }}>{title}</div>
      {trailing}
    </div>
  );
}

// ─── Search overlay (Spotlight-style, MA-backed) ───────────────────────
function SearchOverlay({ tk, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ tracks: [], albums: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults({ tracks: [], albums: [], artists: [], playlists: [] }); return; }
    if (!window.MA?.search) return;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await window.MA.search(q);
        setResults(r);
      } finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  const play = (item) => { window.massPlay?.(item); onClose(); };

  const sections = [
    { label: 'Tracks',    items: results.tracks },
    { label: 'Albums',    items: results.albums },
    { label: 'Artists',   items: results.artists },
    { label: 'Playlists', items: results.playlists },
  ].filter((s) => s.items.length > 0);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: tk.isDark ? 'rgba(0,0,0,.55)' : 'rgba(244,243,239,.55)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      animation: 'obs-fade 180ms ease',
      padding: '64px 0 0',
      display: 'flex', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(720px, 92%)', maxHeight: 'calc(100% - 96px)',
        background: tk.isDark ? 'rgba(20,20,22,.92)' : 'rgba(255,255,255,.92)',
        border: `0.5px solid ${tk.border}`,
        borderRadius: 20, color: tk.text,
        boxShadow: '0 24px 80px rgba(0,0,0,.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderBottom: `0.5px solid ${tk.border}`,
        }}>
          <Icons.Search size={18} style={{ opacity: 0.6 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Apple Music…"
            style={{
              flex: 1, border: 0, outline: 'none',
              background: 'transparent', color: tk.text,
              fontSize: 18, fontFamily: 'inherit', letterSpacing: '-0.01em',
            }} />
          {loading && <div style={{ fontSize: 11, color: tk.text3 }}>Searching…</div>}
          <button onClick={onClose} style={{
            border: `0.5px solid ${tk.border}`, background: 'transparent',
            color: tk.text2, padding: '3px 8px', borderRadius: 6,
            fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}>Esc</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 14px' }}>
          {sections.length === 0 && q.trim() && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: tk.text3, fontSize: 13 }}>
              No results.
            </div>
          )}
          {sections.length === 0 && !q.trim() && (
            <div style={{ padding: 24, textAlign: 'center', color: tk.text3, fontSize: 13 }}>
              Search Apple Music — songs, albums, artists, playlists.
            </div>
          )}
          {sections.map((sec) => (
            <div key={sec.label} style={{ marginTop: 10 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--obs-accent)',
                padding: '6px 12px',
              }}>{sec.label}</div>
              {sec.items.map((it) => (
                <button key={it.id} onClick={() => play(it)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '8px 12px', border: 0,
                  background: 'transparent', color: tk.text, cursor: 'pointer',
                  borderRadius: 12, textAlign: 'left',
                }}>
                  <AlbumArt art={it.art} title={it.title} size={40} radius={8} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.title}
                    </div>
                    {it.subtitle && (
                      <div style={{ fontSize: 11.5, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.subtitle}
                      </div>
                    )}
                  </div>
                  <Icons.Play size={14} style={{ opacity: 0.5 }} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Obsidian, SearchOverlay });
