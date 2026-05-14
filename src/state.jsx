// Shared app state for the Sonos remote. One source of truth used by all
// three design directions — so when you click Play on Direction A and pop
// open Direction B in fullscreen, the room state is consistent.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const DATA = window.SONOS_DATA;

const formatTime = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Global event bus — directions subscribe to "state changed" so all three
// re-render when one updates. (We avoid a heavy context to keep each
// direction self-contained.)
const SonosStore = (() => {
  const listeners = new Set();
  let state = {
    rooms: { ...DATA.initialRoomState },
    activeRoomId: 'living',
    queue: ['t1', 't2', 't4', 't7', 't9'],
    queueIndex: 0,
    // Per-zone playhead seconds; advances when "playing".
    playhead: { living: 47, office: 91, bedroom: 0, dining: 47, bath: 0, garage: 0, move: 0 },
    favorites: new Set(['t1', 't5', 'p2']),
    eq: { bass: 0, treble: 0, loudness: true, balance: 0 },
    // For drag-to-group demo state
    pendingGroupTarget: null,
  };

  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn());
  const get = () => state;
  const set = (mut) => { state = { ...state, ...mut }; emit(); };
  const update = (fn) => { fn(state); emit(); };

  return { subscribe, get, set, update };
})();

// React hook — re-renders on any store change.
function useSonos() {
  const [, force] = useState(0);
  useEffect(() => SonosStore.subscribe(() => force((n) => n + 1)), []);
  return SonosStore.get();
}

// Action helpers — these mutate the store.
const SonosActions = {
  setActiveRoom(id) { SonosStore.update((s) => { s.activeRoomId = id; }); },
  togglePlayRoom(id) {
    SonosStore.update((s) => {
      const r = s.rooms[id];
      if (!r.trackId) r.trackId = s.queue[s.queueIndex];
      r.playing = !r.playing;
      // If grouped, toggle the whole group together.
      if (r.groupId) {
        Object.values(s.rooms).forEach((rr) => {
          if (rr.groupId === r.groupId) {
            rr.playing = r.playing;
            if (!rr.trackId) rr.trackId = r.trackId;
          }
        });
      }
    });
  },
  setVolume(id, v) {
    SonosStore.update((s) => { s.rooms[id].volume = Math.max(0, Math.min(100, v)); });
  },
  nextTrack() {
    SonosStore.update((s) => {
      s.queueIndex = (s.queueIndex + 1) % s.queue.length;
      const tid = s.queue[s.queueIndex];
      const active = s.rooms[s.activeRoomId];
      active.trackId = tid;
      if (active.groupId) {
        Object.values(s.rooms).forEach((rr) => {
          if (rr.groupId === active.groupId) rr.trackId = tid;
        });
      }
      s.playhead[s.activeRoomId] = 0;
    });
  },
  prevTrack() {
    SonosStore.update((s) => {
      s.queueIndex = (s.queueIndex - 1 + s.queue.length) % s.queue.length;
      const tid = s.queue[s.queueIndex];
      const active = s.rooms[s.activeRoomId];
      active.trackId = tid;
      s.playhead[s.activeRoomId] = 0;
    });
  },
  seek(id, sec) { SonosStore.update((s) => { s.playhead[id] = sec; }); },
  toggleFavorite(id) {
    SonosStore.update((s) => {
      const next = new Set(s.favorites);
      if (next.has(id)) next.delete(id); else next.add(id);
      s.favorites = next;
    });
  },
  groupRooms(roomA, roomB) {
    SonosStore.update((s) => {
      const a = s.rooms[roomA];
      const b = s.rooms[roomB];
      const gid = a.groupId || b.groupId || `g${Date.now().toString(36)}`;
      a.groupId = gid; b.groupId = gid;
      // Adopt A's track + playing state.
      b.trackId = a.trackId; b.playing = a.playing;
    });
  },
  ungroup(roomId) {
    SonosStore.update((s) => { s.rooms[roomId].groupId = null; });
  },
  playTrack(trackId) {
    SonosStore.update((s) => {
      const idx = s.queue.indexOf(trackId);
      if (idx >= 0) s.queueIndex = idx;
      else { s.queue = [trackId, ...s.queue]; s.queueIndex = 0; }
      const active = s.rooms[s.activeRoomId];
      active.trackId = trackId; active.playing = true;
      s.playhead[s.activeRoomId] = 0;
    });
  },
  setEq(patch) { SonosStore.update((s) => { s.eq = { ...s.eq, ...patch }; }); },
};

// Tick: advance playhead for every "playing" room. Skips to next track at end.
(() => {
  if (window.__sonosTick) clearInterval(window.__sonosTick);
  window.__sonosTick = setInterval(() => {
    SonosStore.update((s) => {
      let changed = false;
      Object.entries(s.rooms).forEach(([id, r]) => {
        if (!r.playing || !r.trackId) return;
        const t = DATA.tracks.find((x) => x.id === r.trackId);
        if (!t) return;
        s.playhead[id] = (s.playhead[id] || 0) + 0.5;
        if (s.playhead[id] >= t.duration) {
          // Just loop / advance for demo.
          s.queueIndex = (s.queueIndex + 1) % s.queue.length;
          r.trackId = s.queue[s.queueIndex];
          s.playhead[id] = 0;
        }
        changed = true;
      });
      if (!changed) return;
    });
  }, 500);
})();

// Derived getters
const sel = {
  activeRoom: (s) => s.rooms[s.activeRoomId],
  trackFor: (s, roomId) => {
    const r = s.rooms[roomId];
    return r?.trackId ? DATA.tracks.find((t) => t.id === r.trackId) : null;
  },
  groupedWith: (s, roomId) => {
    const gid = s.rooms[roomId]?.groupId;
    if (!gid) return [roomId];
    return DATA.rooms.filter((r) => s.rooms[r.id].groupId === gid).map((r) => r.id);
  },
};

Object.assign(window, { useSonos, SonosStore, SonosActions, sel, formatTime, DATA });
