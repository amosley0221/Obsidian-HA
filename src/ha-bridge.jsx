// Home Assistant <-> SonosStore bridge.
// Auto-discovers MA-managed (preferred) and native Sonos media_players,
// mirrors their state into SonosStore, overrides SonosActions to call HA
// services, and feeds the Library tab from Music Assistant browse.

(function () {
  const { SonosStore, SonosActions, DATA, AlbumColor } = window;

  // ── Entity discovery ────────────────────────────────────────────────────
  // Prefer Music Assistant-managed players if any exist (so MA play_media
  // works); fall back to native Sonos. Returns array of entity_id strings.
  function pickRoomEntities(entityRegistry, states) {
    const stateById = new Map(states.map((s) => [s.entity_id, s]));
    const mediaPlayers = entityRegistry.filter(
      (e) => e.entity_id.startsWith('media_player.') && !e.disabled_by && !e.hidden_by
    );
    const massEntities = mediaPlayers.filter((e) => e.platform === 'mass');
    const sonosEntities = mediaPlayers.filter((e) => e.platform === 'sonos');
    const chosen = (massEntities.length > 0 ? massEntities : sonosEntities)
      .filter((e) => stateById.has(e.entity_id));
    chosen.sort((a, b) => {
      const an = stateById.get(a.entity_id).attributes.friendly_name || a.entity_id;
      const bn = stateById.get(b.entity_id).attributes.friendly_name || b.entity_id;
      return an.localeCompare(bn);
    });
    return { entities: chosen, usingMass: massEntities.length > 0 };
  }

  function roomIconFor(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('living')) return 'sofa';
    if (n.includes('bed')) return 'bed';
    if (n.includes('office') || n.includes('desk') || n.includes('study')) return 'desk';
    if (n.includes('dining') || n.includes('kitchen')) return 'fork';
    if (n.includes('bath')) return 'drop';
    if (n.includes('garage') || n.includes('shop')) return 'wrench';
    if (n.includes('move') || n.includes('roam') || n.includes('portable')) return 'portable';
    return 'speaker';
  }

  // Translate HA media_player state → fields the dashboard expects.
  function deriveTrack(haState, fallbackArt) {
    const a = haState.attributes || {};
    if (!a.media_title) return { track: null, playhead: 0 };
    const title = a.media_title;
    const artist = a.media_artist || '';
    const album = a.media_album_name || '';
    const duration = a.media_duration || 0;
    let position = a.media_position || 0;
    if (haState.state === 'playing' && a.media_position_updated_at) {
      const t = new Date(a.media_position_updated_at).getTime();
      position += (Date.now() - t) / 1000;
      if (duration > 0) position = Math.min(position, duration);
    }
    const artUrl = a.entity_picture
      ? (a.entity_picture.startsWith('http') ? a.entity_picture : a.entity_picture)
      : null;
    const id = `t:${haState.entity_id}:${title}`;
    return {
      track: {
        id, title, artist, album, duration,
        art: { ...fallbackArt, artUrl },
        artUrl,
      },
      playhead: position,
    };
  }

  function groupKeyFor(haState) {
    const g = haState.attributes?.group_members;
    if (!Array.isArray(g) || g.length <= 1) return null;
    return [...g].sort()[0];
  }

  // ── Apply a single HA state to the store ────────────────────────────────
  function applyEntityState(haState) {
    const eid = haState.entity_id;
    SonosStore.update((s) => {
      const r = s.rooms[eid];
      if (!r) return;
      const a = haState.attributes || {};
      r.volume = Math.round((a.volume_level ?? 0) * 100);
      r.playing = haState.state === 'playing';
      r.muted = !!a.is_volume_muted;
      r.source = a.source || null;
      r.groupId = groupKeyFor(haState);

      const fallbackArt = AlbumColor.fallbackArt(a.media_title || a.media_album_name || eid);
      const { track, playhead } = deriveTrack(haState, fallbackArt);
      if (track) {
        DATA.tracks = DATA.tracks.filter((t) => t.id !== track.id);
        DATA.tracks.push(track);
        r.trackId = track.id;
        s.playhead[eid] = playhead;
        if (track.artUrl) {
          AlbumColor.extractFromUrl(track.artUrl).then((extracted) => {
            const stored = DATA.tracks.find((t) => t.id === track.id);
            if (stored) {
              stored.art = { ...stored.art, ...extracted, artUrl: track.artUrl };
              SonosStore.update(() => {});
            }
          });
        }
      } else {
        r.trackId = null;
        s.playhead[eid] = 0;
      }
    });
  }

  // ── Initial population from list of HA states ───────────────────────────
  function populateRooms(states, entityIds) {
    const byId = new Map(states.map((s) => [s.entity_id, s]));
    const rooms = entityIds.map((eid) => {
      const st = byId.get(eid);
      const name = st?.attributes?.friendly_name || eid;
      return { id: eid, name, product: st?.attributes?.device_class || 'Sonos', icon: roomIconFor(name) };
    });

    DATA.rooms = rooms;
    SonosStore.update((s) => {
      s.rooms = {};
      s.playhead = {};
      rooms.forEach((r) => {
        s.rooms[r.id] = { volume: 0, playing: false, trackId: null, source: null, groupId: null };
        s.playhead[r.id] = 0;
      });
      if (rooms.length > 0 && !s.rooms[s.activeRoomId]) {
        s.activeRoomId = rooms[0].id;
      }
    });
    rooms.forEach((r) => {
      const st = byId.get(r.id);
      if (st) applyEntityState(st);
    });
  }

  // ── Music Assistant browse → library shelves ────────────────────────────
  async function refreshLibrary(ha, anyEntityId) {
    if (!anyEntityId) return;
    const browse = async (id) => {
      try {
        return await ha.callWS({
          type: 'media_player/browse_media',
          entity_id: anyEntityId,
          media_content_type: id ? undefined : undefined,
          media_content_id: id,
        });
      } catch (e) { return null; }
    };
    const top = await browse(undefined);
    if (!top || !top.children) return;

    const findChild = (nodes, predicate) => nodes.find(predicate);
    const massRoot = findChild(top.children, (c) =>
      /apple music|music assistant/i.test(c.title || '')
    ) || top;

    const tryBranches = async (root, names) => {
      for (const name of names) {
        const match = (root.children || []).find((c) =>
          c.title && c.title.toLowerCase().includes(name)
        );
        if (match) {
          const sub = await browse(match.media_content_id);
          if (sub && sub.children?.length) return sub.children;
        }
      }
      return [];
    };

    const massFull = await browse(massRoot.media_content_id) || massRoot;
    const playlists = await tryBranches(massFull, ['playlist']);
    const albums    = await tryBranches(massFull, ['album']);
    const stations  = await tryBranches(massFull, ['radio', 'station']);
    const recents   = await tryBranches(massFull, ['recent', 'history']);

    const toShelf = (items, kind) => items.slice(0, 12).map((it) => {
      const fallback = AlbumColor.fallbackArt(it.title);
      const art = it.thumbnail
        ? { ...fallback, bg: `url("${it.thumbnail}") center/cover, ${fallback.bg}`, url: it.thumbnail }
        : fallback;
      return {
        id: it.media_content_id,
        title: it.title,
        artist: it.media_class || kind,
        subtitle: it.media_class || kind,
        count: undefined,
        art,
        _mass: { media_content_id: it.media_content_id, media_content_type: it.media_content_type },
      };
    });

    if (playlists.length) DATA.playlists = toShelf(playlists, 'Playlist');
    if (albums.length)    DATA.albums    = toShelf(albums, 'Album');
    if (stations.length)  DATA.stations  = toShelf(stations, 'Station');
    if (recents.length)   DATA.recents   = toShelf(recents, 'Recent').map((it) => ({
      ...it, subtitle: it.subtitle,
    }));
    SonosStore.update(() => {});
  }

  // ── Action overrides — route through HA services ────────────────────────
  function installActions(ha) {
    const playMedia = (entity_id, item) => {
      if (item._mass) {
        return ha.callService('music_assistant', 'play_media', {
          entity_id,
          media_id: item._mass.media_content_id,
        }).catch(() => ha.callService('media_player', 'play_media', {
          entity_id,
          media_content_id: item._mass.media_content_id,
          media_content_type: item._mass.media_content_type || 'music',
        }));
      }
      return ha.callService('media_player', 'play_media', {
        entity_id,
        media_content_id: item.id,
        media_content_type: 'music',
      });
    };

    Object.assign(SonosActions, {
      setActiveRoom(id) { SonosStore.update((s) => { s.activeRoomId = id; }); },
      togglePlayRoom(id) {
        ha.callService('media_player', 'media_play_pause', { entity_id: id });
      },
      setVolume(id, v) {
        SonosStore.update((s) => { if (s.rooms[id]) s.rooms[id].volume = v; });
        ha.callService('media_player', 'volume_set', {
          entity_id: id, volume_level: Math.max(0, Math.min(1, v / 100)),
        });
      },
      nextTrack() {
        const id = SonosStore.get().activeRoomId;
        ha.callService('media_player', 'media_next_track', { entity_id: id });
      },
      prevTrack() {
        const id = SonosStore.get().activeRoomId;
        ha.callService('media_player', 'media_previous_track', { entity_id: id });
      },
      seek(id, sec) {
        SonosStore.update((s) => { s.playhead[id] = sec; });
        ha.callService('media_player', 'media_seek', { entity_id: id, seek_position: sec });
      },
      toggleFavorite(itemId) {
        SonosStore.update((s) => {
          const next = new Set(s.favorites);
          if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
          s.favorites = next;
          try { localStorage.setItem('sonos-favs', JSON.stringify([...next])); } catch (e) {}
        });
      },
      groupRooms(roomA, roomB) {
        ha.callService('media_player', 'join', {
          entity_id: roomA, group_members: [roomB],
        });
      },
      ungroup(roomId) {
        ha.callService('media_player', 'unjoin', { entity_id: roomId });
      },
      playTrack(id) {
        const item = [...DATA.recents, ...DATA.playlists, ...DATA.albums, ...DATA.stations]
          .find((x) => x.id === id);
        if (!item) return;
        const eid = SonosStore.get().activeRoomId;
        playMedia(eid, item);
      },
      setEq(patch) { SonosStore.update((s) => { s.eq = { ...s.eq, ...patch }; }); },
    });
  }

  // ── Public entry point ──────────────────────────────────────────────────
  async function startHaBridge({ url, token, onStatus }) {
    return new Promise((resolve, reject) => {
      let ready = false;
      const ha = new HaClient({
        url, token,
        onStatus: (status) => {
          onStatus?.(status);
          if (status === 'auth_invalid') reject(new Error('auth_invalid'));
        },
      });

      const init = async () => {
        try {
          const [registry, states] = await Promise.all([ha.getEntityRegistry(), ha.getStates()]);
          const { entities } = pickRoomEntities(registry, states);
          if (entities.length === 0) {
            onStatus?.('no_rooms');
            reject(new Error('no_rooms'));
            return;
          }
          const ids = new Set(entities.map((e) => e.entity_id));
          populateRooms(states, [...ids]);
          installActions(ha);

          await ha.subscribeEvents('state_changed', (event) => {
            const eid = event.data?.entity_id;
            if (!ids.has(eid)) return;
            if (!event.data.new_state) return;
            applyEntityState(event.data.new_state);
          });

          // Restore favorites
          try {
            const saved = JSON.parse(localStorage.getItem('sonos-favs') || '[]');
            SonosStore.update((s) => { s.favorites = new Set(saved); });
          } catch (e) {}

          // Library — runs after rooms are ready, non-blocking.
          refreshLibrary(ha, [...ids][0]);

          // Re-interpolate playhead every 500ms while playing.
          if (window.__sonosTick) clearInterval(window.__sonosTick);
          window.__sonosTick = setInterval(() => {
            SonosStore.update((s) => {
              Object.keys(s.rooms).forEach((id) => {
                if (s.rooms[id].playing) s.playhead[id] = (s.playhead[id] || 0) + 0.5;
              });
            });
          }, 500);

          ready = true;
          resolve(ha);
        } catch (e) {
          reject(e);
        }
      };

      const origOnStatus = ha.onStatus;
      ha.onStatus = (status) => {
        origOnStatus(status);
        if (status === 'connected' && !ready) init();
      };

      ha.connect();
    });
  }

  window.startHaBridge = startHaBridge;
})();
