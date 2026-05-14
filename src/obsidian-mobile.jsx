// Obsidian — Mobile (iPhone)
// Single-column dark-first variant. Bottom tab bar (Listen / Rooms /
// Library / Search). Now Playing is hero. Drag-to-group uses pointer
// events with a 320ms long-press → lift; works on mouse + touch.

function ObsidianMobile({ theme = 'dark', bgStyle = 'halo', onThemeToggle }) {
  const s = useSonos();
  const track = sel.trackFor(s, s.activeRoomId);
  const phead = s.playhead[s.activeRoomId] || 0;
  const active = sel.activeRoom(s);
  const [tab, setTab] = useState('listen');
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Drill events (from search) switch to the Library tab so the drill view
  // is visible — OMLibrary itself listens to populate its drill stack.
  useEffect(() => {
    const handler = () => setTab('library');
    window.addEventListener('sonos-remote:drill', handler);
    return () => window.removeEventListener('sonos-remote:drill', handler);
  }, []);

  const dark = theme === 'dark';
  const glow = track?.art?.dominant || (dark ? 'oklch(0.48 0.10 250)' : 'oklch(0.78 0.10 250)');
  const shadow = track?.art?.shadow || (dark ? 'oklch(0.28 0.10 250)' : 'oklch(0.62 0.10 250)');
  // Accent derived from active track's art (overridable by --tw-accent)
  const trackAcc = track?.art?.hue != null
    ? `oklch(${dark ? 0.76 : 0.48} 0.18 ${track.art.hue})`
    : (dark ? '#ff7e60' : '#c8482e');

  // theme tokens
  const tk = dark ? {
    bg: '#000', text: '#fff',
    text2: 'rgba(255,255,255,.62)', text3: 'rgba(255,255,255,.42)',
    surface: 'rgba(255,255,255,.06)',
    surfaceStrong: 'rgba(255,255,255,.10)',
    border: 'rgba(255,255,255,.10)',
    pillBorder: 'rgba(255,255,255,.10)',
    haloOpacity: 0.55, haloBlur: 80,
    track: 'rgba(255,255,255,.14)',
    invertIcon: '#000', invertBg: '#fff',
    grain: 0.04,
  } : {
    bg: '#f4f3ef', text: '#1a1a1c',
    text2: 'rgba(26,26,28,.62)', text3: 'rgba(26,26,28,.42)',
    surface: 'rgba(255,255,255,.6)',
    surfaceStrong: 'rgba(255,255,255,.85)',
    border: 'rgba(0,0,0,.08)',
    pillBorder: 'rgba(0,0,0,.08)',
    haloOpacity: 0.7, haloBlur: 50,
    track: 'rgba(0,0,0,.08)',
    invertIcon: '#fff', invertBg: '#1a1a1c',
    grain: 0.025,
  };

  return (
    <div className="obsidian-mobile" style={{
      position: 'absolute', inset: 0,
      background: tk.bg, color: tk.text,
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
      letterSpacing: '-0.005em',
      display: 'flex', flexDirection: 'column',
      '--om-text': tk.text, '--om-text2': tk.text2, '--om-text3': tk.text3,
      '--om-surface': tk.surface, '--om-surface-strong': tk.surfaceStrong,
      '--om-border': tk.border, '--om-track': tk.track,
      '--om-accent': `var(--tw-accent, ${trackAcc})`,
      '--om-radius': 'var(--tw-radius, 16px)',
    }}>
      {/* Background: halo / blurred art / solid */}
      {bgStyle === 'art' && track && (
        <>
          <div style={{
            position: 'absolute', inset: -40, pointerEvents: 'none',
            background: track.art.bg, filter: 'blur(70px) saturate(140%)',
            opacity: dark ? 0.45 : 0.32,
          }} />
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: dark
              ? 'linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,.65))'
              : 'linear-gradient(to bottom, rgba(244,243,239,.35), rgba(244,243,239,.7))',
          }} />
        </>
      )}
      {bgStyle === 'halo' && (
        <div style={{
          position: 'absolute', inset: -120, pointerEvents: 'none',
          background: `
            radial-gradient(60% 50% at 30% 20%, ${glow} 0%, transparent 60%),
            radial-gradient(50% 45% at 80% 80%, ${shadow} 0%, transparent 65%)
          `,
          filter: `blur(${tk.haloBlur}px) saturate(120%)`,
          opacity: tk.haloOpacity,
          transition: 'background 600ms ease',
        }} />
      )}
      {/* Grain (always) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: tk.grain,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
      }} />

      {/* Scrollable content */}
      <div style={{
        position: 'relative', zIndex: 1, flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 88, // for tab bar
      }}>
        {tab === 'listen' && (
          <OMListen
            track={track} phead={phead} active={active} tk={tk}
            onExpand={() => setExpanded(true)}
            onQueue={() => setQueueOpen(true)}
          />
        )}
        {tab === 'rooms' && <OMRooms tk={tk} />}
        {tab === 'library' && <OMLibrary tk={tk} />}
        {tab === 'search' && <OMSearch tk={tk} />}
      </div>

      {/* Floating theme toggle — sits in the safe top area above every tab. */}
      {onThemeToggle && (
        <button onClick={onThemeToggle}
                aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
                style={{
                  position: 'absolute', top: 14, right: 14, zIndex: 11,
                  width: 36, height: 36, borderRadius: 999,
                  border: `0.5px solid ${tk.border}`, background: tk.surface,
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  color: tk.text, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  fontSize: 15, lineHeight: 1,
                }}>
          {dark ? '☾' : '☀'}
        </button>
      )}

      {/* Bottom tab bar */}
      <OMTabBar tab={tab} setTab={setTab} tk={tk} />

      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} theme={dark ? 'dark' : 'light'} />
      {expanded && <OMFullscreen track={track} phead={phead} active={active} tk={tk} onClose={() => setExpanded(false)} />}
    </div>
  );
}

// ─── Listen Now ────────────────────────────────────────────────────────
function OMListen({ track, phead, active, tk, onExpand, onQueue }) {
  const s = useSonos();
  const room = DATA.rooms.find((r) => r.id === s.activeRoomId);
  const groupSize = sel.groupedWith(s, s.activeRoomId).length;
  const fav = s.favorites.has(track?.id);

  return (
    <div style={{ padding: '54px 20px 0' }}>
      {/* Header: room selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--om-accent)' }}>
            Now Playing
          </div>
          <button style={{
            marginTop: 2, padding: 0, background: 'transparent', border: 0,
            color: tk.text, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}>
            {room?.name}
            {groupSize > 1 && <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 999,
              background: 'var(--om-accent)', color: '#0a0a0a', fontWeight: 600,
              letterSpacing: 0,
            }}>+{groupSize - 1}</span>}
            <Icons.Down size={18} style={{ opacity: 0.5 }} />
          </button>
        </div>
        <button style={omIcon(tk, 36)}><Icons.AirPlay size={16} /></button>
        <button style={omIcon(tk, 36)}><Icons.More size={16} /></button>
      </div>

      {/* Album art hero */}
      {track ? (
        <div onClick={onExpand} style={{ marginTop: 22, cursor: 'zoom-in' }}>
          <AlbumArt art={track.art} title={track.album} subtitle={track.artist}
                    size={350} radius={22}
                    style={{
                      width: '100%', height: 'auto', aspectRatio: '1 / 1',
                      boxShadow: `0 30px 80px -20px ${track.art.shadow}, 0 0 0 .5px ${tk.border}`,
                    }} />
        </div>
      ) : (
        <div style={{
          marginTop: 22, aspectRatio: '1 / 1', borderRadius: 22,
          background: tk.surface, border: `0.5px solid ${tk.border}`,
          display: 'grid', placeItems: 'center', color: tk.text2,
        }}>
          <Icons.Speaker size={42} />
        </div>
      )}

      {/* Title row */}
      {track && (
        <>
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
                            lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.title}
              </div>
              <div style={{ marginTop: 4, fontSize: 15, color: tk.text2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.artist}
              </div>
            </div>
            <button onClick={() => SonosActions.toggleFavorite(track.id)} style={{
              ...omIcon(tk, 36),
              color: fav ? 'var(--om-accent)' : tk.text,
              opacity: fav ? 1 : 0.7,
            }}>
              {fav ? <Icons.HeartFill size={18} /> : <Icons.Heart size={18} />}
            </button>
            <button onClick={onQueue} style={omIcon(tk, 36)}><Icons.Queue size={16} /></button>
          </div>

          {/* Scrub */}
          <div style={{ marginTop: 18 }}>
            <ScrubBar value={phead} max={track.duration}
                      onSeek={(v) => SonosActions.seek(s.activeRoomId, v)}
                      color={tk.text} track={tk.track} />
          </div>

          {/* Transport */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <button style={omIcon(tk, 40)}><Icons.Shuffle size={18} /></button>
            <button style={omIcon(tk, 48)} onClick={() => SonosActions.prevTrack()}><Icons.Prev size={22} /></button>
            <button onClick={() => SonosActions.togglePlayRoom(s.activeRoomId)} style={{
              width: 72, height: 72, borderRadius: 999, border: 0,
              background: tk.invertBg, color: tk.invertIcon, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 12px 30px rgba(0,0,0,.25)',
            }}>
              {active.playing ? <Icons.Pause size={30} /> : <Icons.Play size={30} style={{ marginLeft: 3 }} />}
            </button>
            <button style={omIcon(tk, 48)} onClick={() => SonosActions.nextTrack()}><Icons.Next size={22} /></button>
            <button style={omIcon(tk, 40)}><Icons.Repeat size={18} /></button>
          </div>

          {/* Volume */}
          <div style={{
            marginTop: 22, padding: '14px 16px',
            background: tk.surface, border: `0.5px solid ${tk.border}`,
            borderRadius: 18,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Icons.VolMin size={16} style={{ opacity: 0.55 }} />
            <div style={{ flex: 1 }}>
              <VolumeSlider value={active.volume}
                onChange={(v) => SonosActions.setVolume(s.activeRoomId, v)}
                accent={tk.text} track={tk.track} height={8} />
            </div>
            <Icons.VolMax size={18} style={{ opacity: 0.6 }} />
          </div>
        </>
      )}

      {/* Mini room cluster: shows other playing rooms */}
      <OMOtherRooms tk={tk} />

      {/* Listen Now shelves */}
      <div style={{ marginTop: 28 }}>
        <h3 style={omShelfTitle(tk)}>Recently Played</h3>
        <OMShelf items={DATA.recents} tk={tk} />
      </div>
      <div style={{ marginTop: 28 }}>
        <h3 style={omShelfTitle(tk)}>Made for You</h3>
        <OMShelf items={DATA.playlists} tk={tk} />
      </div>
    </div>
  );
}

function OMOtherRooms({ tk }) {
  const s = useSonos();
  const others = DATA.rooms.filter((r) => r.id !== s.activeRoomId && s.rooms[r.id].playing);
  if (others.length === 0) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: tk.text3, marginBottom: 10,
      }}>Also playing</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {others.map((r) => {
          const st = s.rooms[r.id];
          const t = st.trackId ? DATA.tracks.find((x) => x.id === st.trackId) : null;
          return (
            <button key={r.id} onClick={() => SonosActions.setActiveRoom(r.id)} style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px 8px 8px', border: `0.5px solid ${tk.border}`,
              background: tk.surface, borderRadius: 999, cursor: 'pointer',
              color: tk.text,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 999,
                background: t?.art?.bg || tk.surfaceStrong,
              }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 540, whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: tk.text3, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t?.title || 'Idle'}
                </div>
              </div>
              <AnimatedWaveform playing color="var(--om-accent)" height={10} width={12} bars={3} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Rooms tab with drag-to-group ──────────────────────────────────────
function OMRooms({ tk }) {
  const s = useSonos();
  const [drag, setDrag] = useState(null); // { id, x, y, fromY }
  const [hoverId, setHoverId] = useState(null);
  const longPressTimer = useRef(null);
  const cardRefs = useRef({});

  // Group rooms for layout
  const groups = useMemo(() => {
    const out = []; const byGroup = new Map();
    for (const r of DATA.rooms) {
      const gid = s.rooms[r.id]?.groupId;
      if (gid) {
        if (!byGroup.has(gid)) { const arr = []; byGroup.set(gid, arr); out.push({ groupId: gid, rooms: arr }); }
        byGroup.get(gid).push(r);
      } else {
        out.push({ groupId: null, rooms: [r] });
      }
    }
    // Playing rooms / groups containing them float to the top.
    out.sort((a, b) => {
      const aPlay = a.rooms.some((r) => s.rooms[r.id]?.playing);
      const bPlay = b.rooms.some((r) => s.rooms[r.id]?.playing);
      if (aPlay && !bPlay) return -1;
      if (bPlay && !aPlay) return 1;
      return 0;
    });
    return out;
  }, [s.rooms]);

  const findRoomAtPoint = (clientX, clientY) => {
    for (const r of DATA.rooms) {
      const el = cardRefs.current[r.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return r.id;
      }
    }
    return null;
  };

  const onPointerDown = (e, roomId) => {
    // Only start long-press on left mouse or touch (not on volume slider)
    if (e.target.closest('[data-no-drag]')) return;
    const startX = e.clientX, startY = e.clientY;
    longPressTimer.current = setTimeout(() => {
      setDrag({ id: roomId, x: startX, y: startY });
      try { e.target.setPointerCapture?.(e.pointerId); } catch {}
      // haptic-feel: brief blur on the lifted card via state
    }, 320);
    // store pointerId for capture later
    e.currentTarget.dataset.pid = e.pointerId;
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    setDrag((d) => ({ ...d, x: e.clientX, y: e.clientY }));
    const hit = findRoomAtPoint(e.clientX, e.clientY);
    if (hit && hit !== drag.id) setHoverId(hit);
    else setHoverId(null);
  };
  const onPointerUp = (e) => {
    clearTimeout(longPressTimer.current);
    if (drag && hoverId && hoverId !== drag.id) {
      SonosActions.groupRooms(hoverId, drag.id);
    }
    setDrag(null); setHoverId(null);
  };
  const onPointerCancel = onPointerUp;

  return (
    <div style={{ padding: '54px 20px 0' }}
         onPointerMove={onPointerMove}
         onPointerUp={onPointerUp}
         onPointerCancel={onPointerCancel}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--om-accent)' }}>
            Speakers
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>Rooms</h1>
        </div>
        <div style={{ fontSize: 12, color: tk.text3 }}>
          {drag ? 'Drop on a room to group' : 'Hold & drag to group'}
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{
            padding: g.groupId ? '6px 6px 6px 10px' : 0,
            background: g.groupId
              ? 'color-mix(in oklab, var(--om-accent) 7%, transparent)'
              : 'transparent',
            border: g.groupId ? '0.5px solid color-mix(in oklab, var(--om-accent) 30%, transparent)' : 'none',
            borderLeft: g.groupId ? '3px solid var(--om-accent)' : 'none',
            borderRadius: g.groupId ? 18 : 0,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {g.groupId && (
              <div style={{
                padding: '6px 8px 2px',
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--om-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icons.Group size={11} /> Grouped · {g.rooms.length}
                </span>
                <button
                  onClick={() => g.rooms.slice(1).forEach((r) => SonosActions.ungroup(r.id))}
                  title="Detach every follower; host keeps playing"
                  style={{ border: 0, background: 'transparent', color: tk.text2,
                           fontSize: 11, fontWeight: 500, cursor: 'pointer', letterSpacing: 0,
                           textTransform: 'none' }}>
                  Ungroup all
                </button>
              </div>
            )}
            {g.rooms.map((r, idx) => (
              <OMRoomCard
                key={r.id}
                ref={(el) => (cardRefs.current[r.id] = el)}
                room={r}
                state={s.rooms[r.id]}
                tk={tk}
                active={s.activeRoomId === r.id}
                lifted={drag?.id === r.id}
                hovered={hoverId === r.id}
                inGroup={!!g.groupId}
                isGroupMaster={!!g.groupId && idx === 0}
                onLeaveGroup={() => SonosActions.ungroup(r.id)}
                onTap={() => SonosActions.setActiveRoom(r.id)}
                onPointerDown={(e) => onPointerDown(e, r.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Floating ghost while dragging */}
      {drag && (() => {
        const room = DATA.rooms.find((r) => r.id === drag.id);
        const st = s.rooms[drag.id];
        const tr = st.trackId ? DATA.tracks.find((x) => x.id === st.trackId) : null;
        return (
          <div style={{
            position: 'fixed', left: drag.x - 130, top: drag.y - 32,
            width: 260, pointerEvents: 'none', zIndex: 100,
            transform: 'rotate(-1.5deg) scale(1.04)',
            transition: 'transform 120ms',
          }}>
            <div style={{
              padding: '12px 14px',
              background: tk.surfaceStrong,
              border: `0.5px solid ${tk.border}`,
              borderRadius: 14,
              boxShadow: '0 22px 48px rgba(0,0,0,.45)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              display: 'flex', alignItems: 'center', gap: 10,
              color: tk.text,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: tr?.art?.bg || tk.surface,
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 540 }}>{room.name}</div>
                <div style={{ fontSize: 11, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Drop on a room to group
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const OMRoomCard = React.forwardRef(function OMRoomCard(
  { room, state, tk, active, lifted, hovered, inGroup, isGroupMaster, onLeaveGroup, onTap, onPointerDown }, ref) {
  const track = state.trackId ? DATA.tracks.find((t) => t.id === state.trackId) : null;
  return (
    <div ref={ref}
      onClick={onTap}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        padding: '12px',
        background: active ? tk.surfaceStrong : tk.surface,
        border: `0.5px solid ${tk.border}`,
        borderRadius: 14,
        cursor: 'pointer',
        opacity: lifted ? 0.4 : 1,
        transform: hovered ? 'scale(0.985)' : 'scale(1)',
        boxShadow: hovered
          ? `0 0 0 2px var(--om-accent), 0 0 0 6px color-mix(in oklab, var(--om-accent) 25%, transparent)`
          : 'none',
        transition: 'transform 160ms, box-shadow 160ms, opacity 160ms',
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Drag handle */}
        <div style={{
          width: 14, opacity: 0.4, color: tk.text2,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <span style={{ width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: track?.art?.bg || tk.surfaceStrong,
          display: 'grid', placeItems: 'center', color: tk.text,
        }}>
          {!track && <RoomIcon id={room.icon} size={18} stroke={1.5} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 540, letterSpacing: '-0.01em',
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room.name}
            </span>
            {isGroupMaster && (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--om-accent)', flexShrink: 0,
              }}>Host</span>
            )}
            {state.playing && <AnimatedWaveform playing color="var(--om-accent)" height={10} width={12} bars={3} />}
          </div>
          <div style={{ fontSize: 11.5, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track ? `${track.title} · ${track.artist}` : `${room.product} · idle`}
          </div>
        </div>
        {inGroup && onLeaveGroup && (
          <button data-no-drag
            onClick={(e) => { e.stopPropagation(); onLeaveGroup(); }}
            aria-label="Leave group"
            title="Leave group"
            style={{
              width: 28, height: 28, borderRadius: 999,
              border: `0.5px solid ${tk.border}`, background: 'transparent',
              color: tk.text2, cursor: 'pointer',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icons.Close size={12} />
          </button>
        )}
        <button data-no-drag onClick={(e) => { e.stopPropagation(); SonosActions.togglePlayRoom(room.id); }} style={{
          width: 36, height: 36, borderRadius: 999, border: 0,
          background: state.playing ? tk.invertBg : tk.surfaceStrong,
          color: state.playing ? tk.invertIcon : tk.text, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          {state.playing ? <Icons.Pause size={14} /> : <Icons.Play size={14} />}
        </button>
      </div>
      <div data-no-drag style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icons.VolMin size={14} style={{ opacity: 0.5 }} />
        <div style={{ flex: 1 }}>
          <VolumeSlider value={state.volume}
            onChange={(v) => SonosActions.setVolume(room.id, v)}
            accent={tk.text} track={tk.track} height={6} />
        </div>
        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', opacity: 0.55, width: 24, textAlign: 'right' }}>
          {state.volume}
        </span>
      </div>
    </div>
  );
});

// ─── Library tab ───────────────────────────────────────────────────────
const OM_CATS = [
  { id: 'recent',    label: 'Recently Played', items: 'recents'  },
  { id: 'tracks',    label: 'Tracks',          items: 'libraryTracks' },
  { id: 'playlists', label: 'Playlists',       items: 'playlists' },
  { id: 'albums',    label: 'Albums',          items: 'albums'   },
  { id: 'artists',   label: 'Artists',         items: 'artists'  },
  { id: 'stations',  label: 'Radio',           items: 'stations' },
];

function omItemBehavior(it) {
  const type = (it._mass?.media_content_type || '').toLowerCase();
  if (type === 'track' || type === 'music') return 'play';
  if (type === 'artist' || type === 'album' || type === 'playlist') return 'drill';
  if (type === 'radio') return 'play';
  if (it.canExpand || it._mass?.can_expand) return 'drill';
  return 'play';
}

function OMLibrary({ tk }) {
  const s = useSonos();
  const [cat, setCat] = useState('recent');
  const [drillStack, setDrillStack] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const current = drillStack[drillStack.length - 1] || null;
  const baseItems = DATA[OM_CATS.find((c) => c.id === cat).items] || [];
  const items = current ? current.children : baseItems;

  const drillInto = async (item) => {
    const id = item._mass?.media_content_id || item.id;
    const mediaType = item._mass?.media_content_type;
    if (!id || !window.MA?.browse) return;
    setDrillLoading(true);
    try {
      const children = await window.MA.browse(id, mediaType);
      setDrillStack((stk) => [...stk, { item, children }]);
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => { if (e.detail) drillInto(e.detail); };
    window.addEventListener('sonos-remote:drill', handler);
    return () => window.removeEventListener('sonos-remote:drill', handler);
  }, []);

  const onItemClick = (it) => {
    if (omItemBehavior(it) === 'drill') drillInto(it);
    else SonosActions.playTrack(it.id);
  };

  const goBack = () => setDrillStack((stk) => stk.slice(0, -1));
  const exitDrill = () => setDrillStack([]);
  const playCurrent = () => current && SonosActions.playTrack(current.item.id);

  return (
    <div style={{ padding: '54px 20px 0' }}>
      {current ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goBack} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 540,
              background: tk.surface, color: tk.text,
              border: `0.5px solid ${tk.border}`, borderRadius: 999,
              cursor: 'pointer',
            }}>← Back</button>
            {drillStack.length > 1 && (
              <button onClick={exitDrill} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 540,
                background: tk.surface, color: tk.text,
                border: `0.5px solid ${tk.border}`, borderRadius: 999,
                cursor: 'pointer',
              }}>Library</button>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <AlbumArt art={current.item.art} title={current.item.title} size={100} radius={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
                            textTransform: 'uppercase', color: 'var(--om-accent)' }}>
                {current.item._mass?.media_content_type || 'Browse'}
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {current.item.title}
              </h1>
              <button onClick={playCurrent} style={{
                marginTop: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600,
                background: 'var(--om-accent)', color: tk.invertIcon,
                border: 0, borderRadius: 999, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icons.Play size={12} /> Play
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--om-accent)' }}>
            Apple Music
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>Library</h1>
          <div style={{ marginTop: 16, display: 'flex', gap: 6, overflowX: 'auto',
                        margin: '16px -20px 0', padding: '0 20px' }}>
            {OM_CATS.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                flex: '0 0 auto', padding: '7px 13px',
                fontSize: 12.5, fontWeight: 540, letterSpacing: '-0.01em',
                background: cat === c.id ? tk.surfaceStrong : tk.surface,
                color: cat === c.id ? tk.text : tk.text2,
                border: `0.5px solid ${tk.border}`,
                borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{c.label}</button>
            ))}
          </div>
        </>
      )}

      {drillLoading && (
        <div style={{ marginTop: 24, color: tk.text3, fontSize: 13, textAlign: 'center' }}>Loading…</div>
      )}
      {!drillLoading && items.length === 0 && (
        <div style={{ marginTop: 24, color: tk.text3, fontSize: 13, textAlign: 'center' }}>
          {current
            ? 'Empty.'
            : (DATA.libraryLoaded
                ? 'Nothing in this section yet.'
                : 'Loading library…')}
        </div>
      )}

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {items.map((it) => (
          <button key={it.id} onClick={() => onItemClick(it)} style={{
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            color: tk.text, textAlign: 'left',
          }}>
            <AlbumArt art={it.art} title={it.title} size={160} radius={12}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }} />
            <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 540, letterSpacing: '-0.005em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.title}
            </div>
            <div style={{ fontSize: 12, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.artist || it.subtitle || `${it.count || 0} songs`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Search tab ────────────────────────────────────────────────────────
function OMSearch({ tk }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ tracks: [], albums: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults({ tracks: [], albums: [], artists: [], playlists: [] }); return; }
    if (!window.MA?.search) return;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { setResults(await window.MA.search(q)); }
      finally { setLoading(false); }
    }, 240);
    return () => clearTimeout(timer.current);
  }, [q]);

  const onPick = (item) => {
    const type = (item._mass?.media_content_type || '').toLowerCase();
    if (type === 'artist' || type === 'album' || type === 'playlist') {
      window.dispatchEvent(new CustomEvent('sonos-remote:drill', { detail: item }));
    } else {
      window.massPlay?.(item);
    }
  };

  const buckets = [
    { label: 'Tracks',    items: results.tracks },
    { label: 'Albums',    items: results.albums },
    { label: 'Artists',   items: results.artists },
    { label: 'Playlists', items: results.playlists },
  ].filter((b) => b.items.length > 0);

  return (
    <div style={{ padding: '54px 20px 0' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--om-accent)' }}>
        Search
      </div>
      <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>Apple Music</h1>

      <div style={{
        marginTop: 16, padding: '0 14px', height: 42,
        display: 'flex', alignItems: 'center', gap: 10,
        background: tk.surface, border: `0.5px solid ${tk.border}`,
        borderRadius: 12, color: tk.text, fontSize: 14,
      }}>
        <Icons.Search size={16} style={{ opacity: 0.6 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, albums, artists, playlists…"
          style={{
            flex: 1, border: 0, outline: 'none',
            background: 'transparent', color: tk.text,
            fontSize: 14, fontFamily: 'inherit',
          }} />
        {loading && <span style={{ fontSize: 11, color: tk.text3 }}>…</span>}
      </div>

      {buckets.length === 0 && q.trim() && !loading && (
        <div style={{ marginTop: 24, color: tk.text3, fontSize: 13, textAlign: 'center' }}>No results.</div>
      )}

      {buckets.map((b) => (
        <div key={b.label} style={{ marginTop: 22 }}>
          <h3 style={omShelfTitle(tk)}>{b.label}</h3>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
            {b.items.map((it) => (
              <button key={it.id} onClick={() => onPick(it)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', background: 'transparent', border: 0,
                color: tk.text, cursor: 'pointer', textAlign: 'left',
                borderBottom: `0.5px solid ${tk.border}`,
              }}>
                <AlbumArt art={it.art} title={it.title} size={44} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize: 12, color: tk.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.subtitle || it.artist}
                  </div>
                </div>
                <Icons.Play size={14} style={{ opacity: 0.5 }} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab bar ───────────────────────────────────────────────────────────
function OMTabBar({ tab, setTab, tk }) {
  const items = [
    { id: 'listen',  label: 'Listen',  Icon: Icons.Play },
    { id: 'rooms',   label: 'Rooms',   Icon: Icons.Speaker },
    { id: 'library', label: 'Library', Icon: Icons.Queue },
    { id: 'search',  label: 'Search',  Icon: Icons.Search },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      zIndex: 10, paddingBottom: 6,
      background: `linear-gradient(to top, ${tk.bg} 65%, transparent 100%)`,
    }}>
      <div style={{
        margin: '0 16px',
        background: tk.surface,
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: `0.5px solid ${tk.border}`,
        borderRadius: 22,
        padding: '6px',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
      }}>
        {items.map((it) => {
          const I = it.Icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 4px 6px', border: 0,
              background: active ? tk.surfaceStrong : 'transparent',
              color: active ? 'var(--om-accent)' : tk.text2,
              borderRadius: 16, cursor: 'pointer',
              transition: 'background 160ms, color 160ms',
            }}>
              <I size={18} />
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fullscreen player ─────────────────────────────────────────────────
function OMFullscreen({ track, phead, active, tk, onClose }) {
  if (!track) return null;
  const s = useSonos();
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: tk.bg, color: tk.text,
      animation: 'om-up 320ms cubic-bezier(.2,.85,.25,1)',
      padding: '20px 20px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@keyframes om-up { from { transform: translateY(20%); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
      {/* halo */}
      <div style={{
        position: 'absolute', inset: -120, pointerEvents: 'none',
        background: `radial-gradient(60% 50% at 30% 30%, ${track.art.dominant} 0%, transparent 60%)`,
        filter: 'blur(80px)', opacity: 0.6,
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '34px 0 8px' }}>
        <button onClick={onClose} style={omIcon(tk, 36)}><Icons.Down size={18} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, color: tk.text3, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Playing in</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{DATA.rooms.find((r) => r.id === s.activeRoomId)?.name}</div>
        </div>
        <button style={omIcon(tk, 36)}><Icons.More size={16} /></button>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 30 }}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <AlbumArt art={track.art} title={track.album} subtitle={track.artist}
                    size={340} radius={24}
                    style={{
                      width: 'min(100%, 340px)', height: 'auto', aspectRatio: '1 / 1',
                      boxShadow: `0 40px 100px -20px ${track.art.shadow}`,
                    }} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{track.title}</div>
          <div style={{ marginTop: 4, fontSize: 15, color: tk.text2 }}>{track.artist}</div>
        </div>
        <ScrubBar value={phead} max={track.duration}
                  onSeek={(v) => SonosActions.seek(s.activeRoomId, v)}
                  color={tk.text} track={tk.track} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <button style={omIcon(tk, 44)} onClick={() => SonosActions.prevTrack()}><Icons.Prev size={22} /></button>
          <button onClick={() => SonosActions.togglePlayRoom(s.activeRoomId)} style={{
            width: 76, height: 76, borderRadius: 999, border: 0,
            background: tk.invertBg, color: tk.invertIcon, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            {active.playing ? <Icons.Pause size={32} /> : <Icons.Play size={32} style={{ marginLeft: 3 }} />}
          </button>
          <button style={omIcon(tk, 44)} onClick={() => SonosActions.nextTrack()}><Icons.Next size={22} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────
function OMShelf({ items, tk }) {
  return (
    <div style={{
      marginTop: 10, display: 'flex', gap: 14, overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      margin: '10px -20px 0', padding: '0 20px 4px',
    }}>
      {items.map((it) => (
        <button key={it.id} onClick={() => SonosActions.playTrack(it.id)} style={{
          flex: '0 0 auto', width: 144, scrollSnapAlign: 'start',
          background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
          color: tk.text, textAlign: 'left',
        }}>
          <AlbumArt art={it.art} title={it.title} size={144} radius={12} />
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 540,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.title}
          </div>
          <div style={{ fontSize: 11.5, color: tk.text3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.artist || it.subtitle || `${it.count || 0} songs`}
          </div>
        </button>
      ))}
    </div>
  );
}

const omShelfTitle = (tk) => ({
  margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em',
  color: tk.text,
});

const omIcon = (tk, size) => ({
  width: size, height: size, borderRadius: 999,
  border: 0, background: tk.surface,
  color: tk.text, cursor: 'pointer',
  display: 'grid', placeItems: 'center',
  flexShrink: 0,
});

Object.assign(window, { ObsidianMobile });
