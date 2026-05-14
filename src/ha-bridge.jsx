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

  // ── Music Assistant: discover config_entry_id, library, search ──────────
  async function discoverMassConfig(ha) {
    // MA's HA integration has used different domain names over time:
    // 'music_assistant' (core / newer) and 'mass' (older HACS custom_component).
    // Try domain-filtered queries first; fall back to a full list + filter.
    const tryDomain = async (domain) => {
      try {
        const entries = await ha.callWS({ type: 'config_entries/get', domain });
        const entry = (entries || []).find((e) => e.state === 'loaded') || entries?.[0];
        if (entry?.entry_id) return { entryId: entry.entry_id, domain };
      } catch (e) {}
      return null;
    };
    for (const domain of ['music_assistant', 'mass']) {
      const r = await tryDomain(domain);
      if (r) { console.log('[sonos-remote] MA config entry', r.entryId, 'domain', domain); return r; }
    }
    try {
      const all = await ha.callWS({ type: 'config_entries/get' });
      const entry = (all || []).find((e) => e.domain === 'music_assistant' || e.domain === 'mass');
      if (entry?.entry_id) {
        console.log('[sonos-remote] MA config entry (via filter)', entry.entry_id, entry.domain);
        return { entryId: entry.entry_id, domain: entry.domain };
      }
    } catch (e) {}
    return null;
  }

  function massImageUrl(item) {
    const img = item?.image || item?.images?.[0]
            || (item?.metadata && item.metadata.images?.[0]);
    if (!img) return null;
    if (typeof img === 'string') return img;
    return img.path || img.url || img.remote_address || null;
  }

  function toShelfFromMass(item) {
    const url = massImageUrl(item);
    const fallback = AlbumColor.fallbackArt(item.name || item.uri || '');
    const art = url ? { ...fallback, artUrl: url } : fallback;
    const artists = Array.isArray(item.artists) && item.artists.length
      ? item.artists.map((a) => a.name).filter(Boolean).join(', ')
      : item.artist?.name || item.owner || '';
    return {
      id: item.uri || item.item_id || item.id,
      title: item.name,
      artist: artists,
      subtitle: artists || item.album?.name || item.media_type || '',
      count: undefined,
      art,
      _mass: {
        uri: item.uri,
        media_type: item.media_type,
        provider: item.provider,
      },
    };
  }

  // Pull a list out of whatever shape MA returned.
  function extractList(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.items)) return result.items;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.results)) return result.results;
    return null;
  }

  // Try every WS shape known across MA versions until one returns a list.
  async function massListLibrary(ha, configEntryId, mediaType) {
    const plural = mediaType + 's';
    const base = configEntryId ? { config_entry_id: configEntryId } : {};
    const variants = [
      { type: 'music_assistant/library', ...base, media_type: mediaType, limit: 30, offset: 0 },
      { type: 'music_assistant/get_library', ...base, media_type: mediaType, limit: 30 },
      { type: 'music_assistant/library_items', ...base, media_type: mediaType, limit: 30 },
      { type: `music_assistant/library/${plural}`, ...base, limit: 30 },
      { type: `mass/library/${plural}`, ...base, limit: 30 },
      { type: 'mass/library', ...base, media_type: mediaType, limit: 30 },
      // No config_entry_id fallback
      { type: 'music_assistant/library', media_type: mediaType, limit: 30 },
      { type: `music_assistant/library/${plural}`, limit: 30 },
    ];
    for (const payload of variants) {
      try {
        const result = await ha.callWS(payload);
        const list = extractList(result);
        if (list) {
          console.log('[sonos-remote] MA', payload.type, mediaType, '→', list.length, 'items');
          return list;
        }
      } catch (e) {
        // ignore — try next variant
      }
    }
    console.warn('[sonos-remote] No MA library command worked for', mediaType);
    return [];
  }

  async function massSearch(ha, configEntryId, query) {
    if (!query || !query.trim()) return { tracks: [], albums: [], artists: [], playlists: [] };
    const base = configEntryId ? { config_entry_id: configEntryId } : {};
    const variants = [
      { type: 'music_assistant/search', ...base,
        search_query: query, media_types: ['track', 'album', 'artist', 'playlist'], limit: 8 },
      { type: 'music_assistant/search', ...base, search_query: query, limit: 8 },
      { type: 'mass/search', ...base, search_query: query,
        media_types: ['track', 'album', 'artist', 'playlist'], limit: 8 },
      { type: 'music_assistant/search', search_query: query, limit: 8 },
    ];
    for (const payload of variants) {
      try {
        const result = await ha.callWS(payload);
        if (!result) continue;
        // Result might be { tracks, albums, ... } or { items: [...] } or a flat array.
        let tracks = [], albums = [], artists = [], playlists = [];
        if (Array.isArray(result.tracks)    || Array.isArray(result.albums)
         || Array.isArray(result.artists)   || Array.isArray(result.playlists)) {
          tracks    = (result.tracks    || []).map(toShelfFromMass);
          albums    = (result.albums    || []).map(toShelfFromMass);
          artists   = (result.artists   || []).map(toShelfFromMass);
          playlists = (result.playlists || []).map(toShelfFromMass);
        } else {
          const list = extractList(result) || [];
          for (const it of list) {
            const shelf = toShelfFromMass(it);
            switch ((it.media_type || '').toLowerCase()) {
              case 'track':    tracks.push(shelf); break;
              case 'album':    albums.push(shelf); break;
              case 'artist':   artists.push(shelf); break;
              case 'playlist': playlists.push(shelf); break;
            }
          }
        }
        console.log('[sonos-remote] MA search via', payload.type,
          '→ tracks', tracks.length, 'albums', albums.length,
          'artists', artists.length, 'playlists', playlists.length);
        return { tracks, albums, artists, playlists };
      } catch (e) {
        // try next
      }
    }
    console.warn('[sonos-remote] All MA search variants failed for', query);
    return { tracks: [], albums: [], artists: [], playlists: [] };
  }

  async function refreshLibrary(ha) {
    const cfg = await discoverMassConfig(ha);
    if (!cfg) {
      console.warn('[sonos-remote] Music Assistant integration not found — library will stay empty');
      DATA.playlists = []; DATA.albums = []; DATA.stations = []; DATA.recents = []; DATA.artists = []; DATA.libraryTracks = [];
      SonosStore.update(() => {});
      return null;
    }
    const { entryId } = cfg;

    const [playlists, albums, artists, tracks, radios] = await Promise.all([
      massListLibrary(ha, entryId, 'playlist'),
      massListLibrary(ha, entryId, 'album'),
      massListLibrary(ha, entryId, 'artist'),
      massListLibrary(ha, entryId, 'track'),
      massListLibrary(ha, entryId, 'radio'),
    ]);

    DATA.playlists     = playlists.map(toShelfFromMass);
    DATA.albums        = albums.map(toShelfFromMass);
    DATA.artists       = artists.map(toShelfFromMass);
    DATA.libraryTracks = tracks.map(toShelfFromMass);
    DATA.stations      = radios.map(toShelfFromMass);
    DATA.recents = [
      ...DATA.libraryTracks.slice(0, 3),
      ...DATA.playlists.slice(0, 3),
    ].map((it) => ({ ...it, subtitle: it.artist || it.subtitle }));

    SonosStore.update(() => {});

    window.MA = {
      configEntryId: entryId,
      search: (q) => massSearch(ha, entryId, q),
    };

    // Diagnostics handle — open the console and type haDebug.testLibrary()
    // to manually exercise the WS API if something looks wrong.
    window.haDebug = {
      client: ha,
      massConfig: cfg,
      listLibrary: (mediaType) => massListLibrary(ha, entryId, mediaType),
      search: (q) => massSearch(ha, entryId, q),
      raw: (payload) => ha.callWS(payload),
    };
    return entryId;
  }

  // ── Action overrides — route through HA services ────────────────────────
  function installActions(ha) {
    const playMedia = (entity_id, item) => {
      const mediaId = item._mass?.uri || item._mass?.media_content_id || item.id;
      // music_assistant.play_media is the canonical path — keeps Apple Music
      // metadata, cover art, and queue semantics intact.
      return ha.callService('music_assistant', 'play_media', {
        entity_id,
        media_id: mediaId,
      }).catch((err) => {
        console.warn('[sonos-remote] music_assistant.play_media failed, falling back', err);
        return ha.callService('media_player', 'play_media', {
          entity_id,
          media_content_id: mediaId,
          media_content_type: item._mass?.media_type || 'music',
        });
      });
    };

    // Expose for the search overlay so it can play results directly.
    window.massPlay = (item) => {
      const eid = SonosStore.get().activeRoomId;
      if (eid) playMedia(eid, item);
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
        const pools = [
          DATA.recents, DATA.playlists, DATA.albums, DATA.stations,
          DATA.artists || [], DATA.libraryTracks || [],
        ];
        const item = pools.flat().find((x) => x && x.id === id);
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
          refreshLibrary(ha);

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
