// Home Assistant <-> SonosStore bridge.
// Auto-discovers MA-managed (preferred) and native Sonos media_players,
// mirrors their state into SonosStore, overrides SonosActions to call HA
// services, and feeds the Library tab from Music Assistant browse.

(function () {
  const { SonosStore, SonosActions, DATA, AlbumColor } = window;

  // Stable handle to one entity we know works for browse_media calls —
  // populated once rooms are discovered.
  let BROWSE_ENTITY = null;

  // ── Entity discovery ────────────────────────────────────────────────────
  // Prefer Music Assistant-managed players if any exist (so MA play_media
  // works); fall back to native Sonos. Returns array of entity_id strings.
  function pickRoomEntities(entityRegistry, states) {
    const stateById = new Map(states.map((s) => [s.entity_id, s]));
    const mediaPlayers = entityRegistry.filter(
      (e) => e.entity_id.startsWith('media_player.') && !e.disabled_by && !e.hidden_by
    );
    // Native Sonos integration entities — used to identify which players
    // are actually Sonos speakers (MA wraps everything: TVs, MacBooks, etc.).
    const sonosNativeEntities = mediaPlayers.filter((e) => e.platform === 'sonos');
    const sonosNamesLower = new Set();
    for (const e of sonosNativeEntities) {
      const name = stateById.get(e.entity_id)?.attributes?.friendly_name;
      if (name) sonosNamesLower.add(name.toLowerCase());
    }

    const allMaEntities = mediaPlayers.filter(
      (e) => e.platform === 'music_assistant' || e.platform === 'mass'
    );
    // If we have native Sonos entries, narrow MA entities down to those whose
    // friendly name matches a Sonos speaker (filters out TVs, MacBooks, etc.).
    let maEntities = allMaEntities;
    if (sonosNamesLower.size > 0) {
      maEntities = allMaEntities.filter((e) => {
        const name = stateById.get(e.entity_id)?.attributes?.friendly_name?.toLowerCase();
        return name && sonosNamesLower.has(name);
      });
      console.log('[sonos-remote] Narrowed MA entities to Sonos:',
        maEntities.length, 'of', allMaEntities.length);
    }

    const usingMass = maEntities.length > 0;
    const chosen = (usingMass ? maEntities : sonosNativeEntities)
      .filter((e) => stateById.has(e.entity_id));
    chosen.sort((a, b) => {
      const an = stateById.get(a.entity_id).attributes.friendly_name || a.entity_id;
      const bn = stateById.get(b.entity_id).attributes.friendly_name || b.entity_id;
      return an.localeCompare(bn);
    });
    console.log('[sonos-remote] Discovery:', chosen.length, 'rooms via',
      usingMass ? 'Music Assistant' : 'native Sonos');
    if (chosen.length > 0) {
      console.log('[sonos-remote] Entities:', chosen.map((e) => e.entity_id).join(', '));
    }
    return { entities: chosen, usingMass };
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
    if (rooms.length > 0) BROWSE_ENTITY = rooms[0].id;
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
    if (Array.isArray(result?.children)) return result.children;
    if (Array.isArray(result?.result)) return result.result;
    return null;
  }

  // ─ media_player/browse_media wrappers ─────────────────────────────────
  async function browse(ha, entityId, id) {
    const payload = {
      type: 'media_player/browse_media',
      entity_id: entityId,
      ...(id ? { media_content_id: id } : {}),
    };
    try {
      return await ha.callWS(payload);
    } catch (e) {
      console.log('[sonos-remote] browse_media error', id || '<root>', e?.message || e);
      return null;
    }
  }

  function shelfFromBrowseNode(node) {
    const url = node.thumbnail || null;
    const fallback = AlbumColor.fallbackArt(node.title || node.media_content_id || '');
    const art = url ? { ...fallback, artUrl: url } : fallback;
    return {
      id: node.media_content_id,
      title: node.title,
      artist: '',
      subtitle: (node.media_class || node.media_content_type || '').toString(),
      art,
      _mass: {
        uri: node.media_content_id,
        media_content_id: node.media_content_id,
        media_content_type: node.media_content_type,
      },
    };
  }

  // Walk an MA browse tree and bucket items by media_class. Caps work by
  // depth and per-bucket size so a huge library doesn't pin the WS.
  async function refreshLibraryViaBrowse(ha, entityId) {
    const shelves = { playlists: [], albums: [], artists: [], tracks: [], radios: [] };
    const root = await browse(ha, entityId, undefined);
    if (!root) {
      console.warn('[sonos-remote] browse_media returned nothing at root');
      return shelves;
    }
    console.log('[sonos-remote] Browse root has', (root.children || []).length, 'children');
    if (root.children) {
      console.log('[sonos-remote] Root branches:', root.children.map((c) => c.title).join(' / '));
    }

    const visited = new Set();
    const MAX_DEPTH = 5;
    const PER_BUCKET = 40;

    async function walk(node, depth) {
      if (depth > MAX_DEPTH) return;
      if (node?.media_content_id) {
        if (visited.has(node.media_content_id)) return;
        visited.add(node.media_content_id);
      }
      const data = node.children
        ? node
        : (node.media_content_id ? await browse(ha, entityId, node.media_content_id) : null);
      const children = data?.children || [];
      for (const child of children) {
        const cls = (child.media_class || '').toLowerCase();
        const type = (child.media_content_type || '').toLowerCase();
        // Classify by media_class / media_content_type. Note: MA often uses
        // media_class='music' for tracks and 'directory' for navigable nodes.
        if (cls === 'playlist' || type === 'playlist') {
          if (shelves.playlists.length < PER_BUCKET) shelves.playlists.push(shelfFromBrowseNode(child));
        } else if (cls === 'album' || type === 'album') {
          if (shelves.albums.length < PER_BUCKET) shelves.albums.push(shelfFromBrowseNode(child));
        } else if (cls === 'artist' || type === 'artist') {
          if (shelves.artists.length < PER_BUCKET) shelves.artists.push(shelfFromBrowseNode(child));
        } else if (cls === 'track' || cls === 'music' || type === 'track' || type === 'music') {
          if (shelves.tracks.length < PER_BUCKET) shelves.tracks.push(shelfFromBrowseNode(child));
        } else if (type === 'radio' || cls === 'radio' || cls === 'channel') {
          if (shelves.radios.length < PER_BUCKET) shelves.radios.push(shelfFromBrowseNode(child));
        } else if (child.can_expand && depth < MAX_DEPTH) {
          // Directory / category → drill in
          await walk(child, depth + 1);
        }
        if (Object.values(shelves).every((b) => b.length >= PER_BUCKET)) return;
      }
    }
    await walk(root, 0);
    console.log('[sonos-remote] Browse complete:',
      'playlists', shelves.playlists.length,
      'albums',    shelves.albums.length,
      'artists',   shelves.artists.length,
      'tracks',    shelves.tracks.length,
      'radios',    shelves.radios.length);
    return shelves;
  }

  // ─ media_player/search_media — standard HA WS command MA plugs into ────
  async function searchViaMediaPlayer(ha, entityId, query) {
    if (!entityId || !query?.trim()) {
      return { tracks: [], albums: [], artists: [], playlists: [] };
    }
    const variants = [
      { type: 'media_player/search_media', entity_id: entityId, search_query: query },
      { type: 'media_player/search_media', entity_id: entityId, search_query: query,
        media_filter_classes: ['track', 'album', 'artist', 'playlist'] },
    ];
    for (const payload of variants) {
      try {
        const result = await ha.callWS(payload);
        if (!result) continue;
        const items = extractList(result) || extractList(result.result) || [];
        if (!items.length) {
          console.log('[sonos-remote] search_media returned 0 results for', query);
          continue;
        }
        const buckets = { tracks: [], albums: [], artists: [], playlists: [] };
        for (const it of items) {
          const cls = (it.media_class || '').toLowerCase();
          const type = (it.media_content_type || '').toLowerCase();
          const shelf = shelfFromBrowseNode(it);
          if (cls === 'track' || cls === 'music' || type === 'track' || type === 'music') buckets.tracks.push(shelf);
          else if (cls === 'album' || type === 'album') buckets.albums.push(shelf);
          else if (cls === 'artist' || type === 'artist') buckets.artists.push(shelf);
          else if (cls === 'playlist' || type === 'playlist') buckets.playlists.push(shelf);
        }
        console.log('[sonos-remote] ✓ search_media',
          '→ tracks', buckets.tracks.length, 'albums', buckets.albums.length,
          'artists', buckets.artists.length, 'playlists', buckets.playlists.length);
        return buckets;
      } catch (e) {
        console.log('[sonos-remote] search_media shape', payload.type, '✗', e?.message || e);
      }
    }
    console.warn('[sonos-remote] All search_media variants failed for', query);
    return { tracks: [], albums: [], artists: [], playlists: [] };
  }

  async function refreshLibrary(ha) {
    const entityId = BROWSE_ENTITY;
    if (!entityId) {
      console.warn('[sonos-remote] No browse entity available — skipping library load');
      return null;
    }

    const shelves = await refreshLibraryViaBrowse(ha, entityId);

    DATA.playlists     = shelves.playlists;
    DATA.albums        = shelves.albums;
    DATA.artists       = shelves.artists;
    DATA.libraryTracks = shelves.tracks;
    DATA.stations      = shelves.radios;
    DATA.recents = [
      ...DATA.libraryTracks.slice(0, 3),
      ...DATA.playlists.slice(0, 3),
    ];

    SonosStore.update(() => {});

    window.MA = {
      browseEntity: entityId,
      search: (q) => searchViaMediaPlayer(ha, entityId, q),
      browse: async (mediaContentId) => {
        const result = await browse(ha, entityId, mediaContentId);
        return (result?.children || []).map(shelfFromBrowseNode);
      },
    };

    window.haDebug = {
      client: ha,
      browseEntity: entityId,
      browseRoot: () => ha.callWS({ type: 'media_player/browse_media', entity_id: entityId }),
      browse: (mediaContentId) => ha.callWS({
        type: 'media_player/browse_media', entity_id: entityId, media_content_id: mediaContentId,
      }),
      search: (q) => searchViaMediaPlayer(ha, entityId, q),
      rawSearch: (q) => ha.callWS({ type: 'media_player/search_media', entity_id: entityId, search_query: q }),
      raw: (payload) => ha.callWS(payload),
    };
    return entityId;
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
