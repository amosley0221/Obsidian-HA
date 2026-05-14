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

      <ObsidianTopbar onQueue={() => setQueueOpen(true)} tk={tk} theme={theme} onThemeToggle={onThemeToggle} />

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
function ObsidianTopbar({ onQueue, tk, theme, onThemeToggle }) {
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

      <TopbarSearch tk={tk} />

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
                <button
                  onClick={() => g.rooms.slice(1).forEach((r) => SonosActions.ungroup(r.id))}
                  title="Detach every follower; host keeps playing"
                  style={{
                    border: 0, background: 'transparent', color: tk.text3,
                    fontSize: 10.5, fontWeight: 500, cursor: 'pointer', letterSpacing: 0, textTransform: 'none',
                  }}>Ungroup all</button>
              </div>
            )}
            {g.rooms.map((r, idx) => (
              <RoomCard
                key={r.id} tk={tk}
                room={r}
                state={s.rooms[r.id]}
                active={s.activeRoomId === r.id}
                hovered={hoverRoom === r.id && dragRoom && dragRoom !== r.id}
                inGroup={!!g.groupId}
                isGroupMaster={!!g.groupId && idx === 0}
                onLeaveGroup={() => SonosActions.ungroup(r.id)}
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

function RoomCard({ room, state, active, hovered, inGroup, isGroupMaster, onLeaveGroup, tk, onClick, onPlayToggle, onVolume, onDragStart, onDragEnd, onDragOver }) {
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
            {isGroupMaster && (
              <span style={{
                flexShrink: 0, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--obs-accent)',
              }}>Host</span>
            )}
            {state.playing && <span style={{ flexShrink: 0 }}><AnimatedWaveform playing color="var(--obs-accent)" height={10} width={12} bars={3} /></span>}
          </div>
          <div style={{ fontSize: 11, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {track ? `${track.title} · ${track.artist}` : `${room.product} · idle`}
          </div>
        </div>
        {inGroup && onLeaveGroup && (
          <button
            onClick={(e) => { e.stopPropagation(); onLeaveGroup(); }}
            aria-label="Leave group"
            title="Leave group"
            style={{
              width: 24, height: 24, borderRadius: 999,
              border: `0.5px solid ${tk.border}`, background: 'transparent',
              color: tk.text2, cursor: 'pointer',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icons.Close size={11} />
          </button>
        )}
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

// Classifies an item: 'track' plays immediately; everything else drills in.
function itemBehavior(it) {
  const type = (it._mass?.media_content_type || '').toLowerCase();
  if (type === 'track' || type === 'music') return 'play';
  if (type === 'artist' || type === 'album' || type === 'playlist') return 'drill';
  if (type === 'radio') return 'play';
  // Anything else with can_expand drills in; otherwise play
  if (it.canExpand || it._mass?.can_expand) return 'drill';
  return 'play';
}

function ObsidianLibrary({ section, setSection, tk }) {
  const s = useSonos();
  const [drillStack, setDrillStack] = useState([]); // [{ item, children, loading }]
  const [drillLoading, setDrillLoading] = useState(false);

  const baseItems = useMemo(() => {
    switch (section) {
      case 'listen-now': return (DATA.recents || []).slice(0, 12);
      case 'tracks':     return DATA.libraryTracks || [];
      case 'playlists':  return DATA.playlists || [];
      case 'albums':     return DATA.albums || [];
      case 'artists':    return DATA.artists || [];
      case 'radio':      return DATA.stations || [];
      default:           return [];
    }
  }, [section, s]);

  const current = drillStack[drillStack.length - 1] || null;
  const items = current ? current.children : baseItems;

  const drillInto = async (item) => {
    const id = item._mass?.media_content_id || item.id;
    if (!id || !window.MA?.browse) return;
    setDrillLoading(true);
    try {
      const children = await window.MA.browse(id);
      setDrillStack((stack) => [...stack, { item, children }]);
    } finally {
      setDrillLoading(false);
    }
  };

  // Search results dispatch this event when the user picks an artist/album/playlist.
  useEffect(() => {
    const handler = (e) => { if (e.detail) drillInto(e.detail); };
    window.addEventListener('sonos-remote:drill', handler);
    return () => window.removeEventListener('sonos-remote:drill', handler);
  }, [drillStack]);

  const onItemClick = (it) => {
    if (itemBehavior(it) === 'drill') drillInto(it);
    else SonosActions.playTrack(it.id);
  };

  const goBack = () => setDrillStack((s) => s.slice(0, -1));
  const exitDrill = () => setDrillStack([]);
  const playCurrent = () => current && SonosActions.playTrack(current.item.id);

  return (
    <div style={panel(tk)}>
      <div style={{ padding: '16px 16px 6px' }}>
        {current ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={goBack} style={{ ...ghostBtn(tk), padding: '4px 8px' }}>
                ← Back
              </button>
              {drillStack.length > 1 && (
                <button onClick={exitDrill} style={{ ...ghostBtn(tk), padding: '4px 8px' }}>
                  Library
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={playCurrent} style={{
                ...ghostBtn(tk), padding: '4px 10px',
                background: 'var(--obs-accent)', color: tk.isDark ? '#0a0a0a' : '#fff',
                border: 0, fontWeight: 600,
              }}>
                <Icons.Play size={11} /> Play
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlbumArt art={current.item.art} title={current.item.title} size={48} radius={10} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {current.item.title}
                </div>
                <div style={{ fontSize: 11, color: tk.text3, textTransform: 'uppercase',
                              letterSpacing: '0.12em', marginTop: 2 }}>
                  {current.item._mass?.media_content_type || 'Browse'}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--obs-accent)', whiteSpace: 'nowrap' }}>
                Apple Music
              </div>
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
          </>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 14px 14px' }}>
        {drillLoading && (
          <div style={{ padding: '20px', textAlign: 'center', color: tk.text3, fontSize: 12 }}>
            Loading…
          </div>
        )}
        {!drillLoading && items.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: tk.text3, fontSize: 12 }}>
            {current ? 'Empty.' : 'Library still loading from Music Assistant…'}
          </div>
        )}
        {items.map((it) => {
          const behavior = itemBehavior(it);
          return (
            <button key={it.id} onClick={() => onItemClick(it)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '8px', border: 0, background: 'transparent',
              color: tk.text, cursor: 'pointer', borderRadius: 12,
              textAlign: 'left',
            }}>
              <AlbumArt art={it.art} title={it.title} size={48} radius={10} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.artist || it.subtitle || ''}
                </div>
              </div>
              {behavior === 'play'
                ? <Icons.Play size={14} style={{ opacity: 0.5 }} />
                : <span style={{ opacity: 0.5, fontSize: 14 }}>›</span>}
            </button>
          );
        })}
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

// ─── Inline topbar search (live MA results dropdown) ──────────────────
function TopbarSearch({ tk }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ tracks: [], albums: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults({ tracks: [], albums: [], artists: [], playlists: [] }); return; }
    if (!window.MA?.search) return;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { setResults(await window.MA.search(q)); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  // Click outside → collapse
  useEffect(() => {
    if (!focused) return;
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [focused]);

  // Side-by-side drill stack — clicking an artist opens a second panel to
  // the right showing their albums + tracks; clicking an album in that
  // panel opens a third panel further right with the tracklist.
  const [drillStack, setDrillStack] = useState([]); // [{ item, children, loading }]

  const drillInto = async (item) => {
    setDrillStack((s) => [...s, { item, children: [], loading: true }]);
    try {
      const id = item._mass?.media_content_id || item.id;
      const children = (await window.MA?.browse(id)) || [];
      setDrillStack((s) => {
        const next = [...s];
        next[next.length - 1] = { item, children, loading: false };
        return next;
      });
    } catch (e) {
      setDrillStack((s) => s.slice(0, -1));
    }
  };

  const onPick = (item) => {
    const type = (item._mass?.media_content_type || '').toLowerCase();
    const drill = type === 'artist' || type === 'album' || type === 'playlist';
    if (drill) {
      drillInto(item);
      return;
    }
    window.massPlay?.(item);
    setQ('');
    setFocused(false);
    setDrillStack([]);
    inputRef.current?.blur();
  };

  const playFromDrill = (panel) => {
    if (!panel?.item) return;
    SonosActions.playTrack(panel.item.id);
  };

  // When q changes, reset drill stack so old drills don't linger.
  useEffect(() => { if (!q) setDrillStack([]); }, [q]);

  const sections = [
    { label: 'Artists',   items: results.artists },
    { label: 'Albums',    items: results.albums },
    { label: 'Playlists', items: results.playlists },
    { label: 'Tracks',    items: results.tracks },
  ].filter((s) => s.items.length > 0);

  const showDropdown = focused && q.trim().length > 0;

  return (
    <div ref={wrapRef} style={{
      position: 'relative', flex: '1 1 auto', minWidth: 0, maxWidth: 420,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', height: 34, boxSizing: 'border-box',
        background: tk.surface,
        border: `0.5px solid ${focused ? 'var(--obs-accent)' : tk.border}`,
        borderRadius: 999, fontSize: 13,
        transition: 'border-color 140ms',
      }}>
        <Icons.Search size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQ(''); setFocused(false); e.currentTarget.blur(); }
          }}
          placeholder="Search Apple Music…"
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none',
            background: 'transparent', color: tk.text,
            fontSize: 13, fontFamily: 'inherit',
          }} />
        {loading && <span style={{ flexShrink: 0, fontSize: 10.5, color: tk.text3, fontFamily: 'var(--font-mono)' }}>…</span>}
        {q && !loading && (
          <button onClick={() => { setQ(''); inputRef.current?.focus(); }}
            style={{ border: 0, background: 'transparent', color: tk.text3, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
            aria-label="Clear search">
            <Icons.Close size={13} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          display: 'flex', alignItems: 'flex-start', gap: 8,
          zIndex: 50,
        }}>
          {/* Search results column */}
          <div style={{
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 96px)',
            background: tk.isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.95)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: `0.5px solid ${tk.border}`,
            borderRadius: 16, color: tk.text,
            boxShadow: '0 24px 60px rgba(0,0,0,.4)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            <div style={{ overflowY: 'auto', padding: '8px 8px 12px', flex: 1 }}>
              {sections.length === 0 && !loading && (
                <div style={{ padding: 20, textAlign: 'center', color: tk.text3, fontSize: 13 }}>
                  No results.
                </div>
              )}
              {sections.map((sec) => (
                <div key={sec.label} style={{ marginTop: 4 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'var(--obs-accent)',
                    padding: '8px 12px 4px',
                  }}>{sec.label}</div>
                  {sec.items.map((it) => {
                    const itemType = (it._mass?.media_content_type || '').toLowerCase();
                    const drillable = itemType === 'artist' || itemType === 'album' || itemType === 'playlist';
                    const active = drillable && drillStack[0]?.item?.id === it.id;
                    return (
                      <button key={it.id} onClick={() => onPick(it)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '6px 10px', border: 0,
                        background: active ? tk.surfaceStrong : 'transparent',
                        color: tk.text, cursor: 'pointer',
                        borderRadius: 10, textAlign: 'left',
                      }}>
                        <AlbumArt art={it.art} title={it.title} size={36} radius={6} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.title}
                          </div>
                          {it.subtitle && (
                            <div style={{ fontSize: 11, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.subtitle}
                            </div>
                          )}
                        </div>
                        {drillable
                          ? <span style={{ opacity: 0.5, fontSize: 14 }}>›</span>
                          : <Icons.Play size={12} style={{ opacity: 0.5 }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Drill panels — one per level (artist → album → tracklist) */}
          {drillStack.map((panel, idx) => (
            <DrillPanel
              key={idx + ':' + (panel.item.id || idx)}
              tk={tk}
              panel={panel}
              onItemPick={onPick}
              onPlay={() => playFromDrill(panel)}
              onBack={() => setDrillStack((s) => s.slice(0, idx))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DrillPanel({ tk, panel, onItemPick, onPlay, onBack }) {
  return (
    <div style={{
      width: 'min(360px, calc(100vw - 32px))',
      maxHeight: 'calc(100vh - 96px)',
      background: tk.isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.95)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      border: `0.5px solid ${tk.border}`,
      borderRadius: 16, color: tk.text,
      boxShadow: '0 24px 60px rgba(0,0,0,.4)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `0.5px solid ${tk.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlbumArt art={panel.item.art} title={panel.item.title} size={40} radius={6} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: 'var(--obs-accent)' }}>
            {(panel.item._mass?.media_content_type || '').toString() || 'Browse'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {panel.item.title}
          </div>
        </div>
        <button onClick={onPlay} aria-label="Play"
          style={{
            width: 32, height: 32, borderRadius: 999, border: 0,
            background: 'var(--obs-accent)', color: tk.isDark ? '#0a0a0a' : '#fff',
            cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}>
          <Icons.Play size={14} />
        </button>
      </div>

      {/* Items */}
      <div style={{ overflowY: 'auto', padding: '6px 6px 12px', flex: 1 }}>
        {panel.loading && (
          <div style={{ padding: 20, textAlign: 'center', color: tk.text3, fontSize: 12 }}>Loading…</div>
        )}
        {!panel.loading && panel.children.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: tk.text3, fontSize: 12 }}>Empty.</div>
        )}
        {panel.children.map((it) => {
          const itemType = (it._mass?.media_content_type || '').toLowerCase();
          const drillable = itemType === 'artist' || itemType === 'album' || itemType === 'playlist';
          return (
            <button key={it.id} onClick={() => onItemPick(it)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '6px 10px', border: 0,
              background: 'transparent', color: tk.text, cursor: 'pointer',
              borderRadius: 10, textAlign: 'left',
            }}>
              <AlbumArt art={it.art} title={it.title} size={34} radius={6} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.title}
                </div>
                {it.subtitle && (
                  <div style={{ fontSize: 11, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.subtitle}
                  </div>
                )}
              </div>
              {drillable
                ? <span style={{ opacity: 0.5, fontSize: 14 }}>›</span>
                : <Icons.Play size={12} style={{ opacity: 0.5 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Obsidian, TopbarSearch });
