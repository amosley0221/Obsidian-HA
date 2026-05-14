// Home Assistant <-> SonosStore bridge.
// Auto-discovers MA-managed (preferred) and native Sonos media_players,
// mirrors their state into SonosStore, overrides SonosActions to call HA
// services, and feeds the Library tab from Music Assistant browse.

(function () {
  const { SonosStore, SonosActions, DATA, AlbumColor } = window;

  // Stable handle to one entity we know works for browse_media calls —
  // populated once rooms are discovered.
  let BROWSE_ENTITY = null;

  // Recently-touched entities. After the user joins/unjoins rooms we don't
  // want incoming state_changed events to clobber the optimistic groupId
  // before HA has actually finished processing the join (HA fires
  // state_changed with stale group_members during the operation).
  const PENDING_GROUP_OPS = new Map(); // entity_id -> expiry timestamp (ms)
  const GROUP_GRACE_MS = 3000;
  const markPendingGroup = (entityId) => {
    PENDING_GROUP_OPS.set(entityId, Date.now() + GROUP_GRACE_MS);
  };
  const isGroupPending = (entityId) => {
    const expiry = PENDING_GROUP_OPS.get(entityId);
    if (!expiry) return false;
    if (Date.now() > expiry) { PENDING_GROUP_OPS.delete(entityId); return false; }
    return true;
  };

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
      // Skip groupId reconcile during the optimistic grace window — HA
      // tends to fire stale state_changed events while a join/unjoin is
      // in flight, which would clobber the just-set optimistic value.
      if (!isGroupPending(eid)) {
        r.groupId = groupKeyFor(haState);
      }

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
  // HA's WS schema requires media_content_id AND media_content_type to be
  // passed TOGETHER. Pass neither at root (no id), pass both on descent.
  async function browse(ha, entityId, id, mediaType) {
    const payload = {
      type: 'media_player/browse_media',
      entity_id: entityId,
      ...(id ? { media_content_id: id, media_content_type: mediaType } : {}),
    };
    try {
      return await ha.callWS(payload);
    } catch (e) {
      console.log('[sonos-remote] browse_media error', id || '<root>', e?.message || e);
      return null;
    }
  }

  function shelfFromBrowseNode(node, typeOverride) {
    const url = node.thumbnail || null;
    const fallback = AlbumColor.fallbackArt(node.title || node.media_content_id || '');
    const art = url ? { ...fallback, artUrl: url } : fallback;
    const effectiveType = typeOverride || node.media_content_type;
    return {
      id: node.media_content_id,
      title: node.title,
      artist: '',
      subtitle: (typeOverride || node.media_class || node.media_content_type || '').toString(),
      art,
      _mass: {
        uri: node.media_content_id,
        media_content_id: node.media_content_id,
        // Force the type so downstream drill / play behavior treats it
        // correctly even when MA tags directories with media_class=directory.
        media_content_type: effectiveType,
      },
    };
  }

  // Map a branch title to the type its children should inherit.
  function hintFromTitle(title) {
    const t = (title || '').toLowerCase();
    if (/artist/.test(t))                 return 'artist';
    if (/album/.test(t))                  return 'album';
    if (/playlist/.test(t))               return 'playlist';
    if (/radio|station/.test(t))          return 'radio';
    if (/track|song/.test(t))             return 'track';
    return null;
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
    const MAX_DEPTH = 6;
    const PER_BUCKET = 60;

    // typeHint is set when a parent branch's title indicates what its
    // children should be ('Artists' → typeHint='artist'). MA tags artist /
    // album / playlist nodes with media_class='directory', so without the
    // hint they'd just look like containers to recurse into and we'd flatten
    // everything to tracks.
    async function walk(node, depth, typeHint) {
      if (depth > MAX_DEPTH) return;
      if (node?.media_content_id) {
        if (visited.has(node.media_content_id)) return;
        visited.add(node.media_content_id);
      }
      const data = node.children
        ? node
        : (node.media_content_id
            ? await browse(ha, entityId, node.media_content_id, node.media_content_type)
            : null);
      const children = data?.children || [];
      for (const child of children) {
        const cls = (child.media_class || '').toLowerCase();
        const type = (child.media_content_type || '').toLowerCase();
        // Explicit type/class wins; otherwise inherit from parent branch.
        let cat = null;
        if (type === 'artist' || cls === 'artist') cat = 'artist';
        else if (type === 'album' || cls === 'album') cat = 'album';
        else if (type === 'playlist' || cls === 'playlist') cat = 'playlist';
        else if (type === 'radio' || cls === 'radio' || cls === 'channel') cat = 'radio';
        else if (type === 'track' || cls === 'track' || cls === 'music' || type === 'music') cat = 'track';
        else if (typeHint && child.can_expand) cat = typeHint;

        if (cat === 'artist') {
          if (shelves.artists.length < PER_BUCKET) shelves.artists.push(shelfFromBrowseNode(child, 'artist'));
        } else if (cat === 'album') {
          if (shelves.albums.length < PER_BUCKET) shelves.albums.push(shelfFromBrowseNode(child, 'album'));
        } else if (cat === 'playlist') {
          if (shelves.playlists.length < PER_BUCKET) shelves.playlists.push(shelfFromBrowseNode(child, 'playlist'));
        } else if (cat === 'radio') {
          if (shelves.radios.length < PER_BUCKET) shelves.radios.push(shelfFromBrowseNode(child, 'radio'));
        } else if (cat === 'track') {
          if (shelves.tracks.length < PER_BUCKET) shelves.tracks.push(shelfFromBrowseNode(child, 'track'));
        } else if (child.can_expand && depth < MAX_DEPTH) {
          // Unclassified directory — descend, passing along an inferred
          // hint based on this child's title ("Artists", "Albums", ...).
          const nextHint = hintFromTitle(child.title) || typeHint;
          await walk(child, depth + 1, nextHint);
        }
        if (Object.values(shelves).every((b) => b.length >= PER_BUCKET)) return;
      }
    }
    await walk(root, 0, null);
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
          // media_content_type FIRST — see comment in refreshLibraryViaBrowse.
          if (type === 'artist' || cls === 'artist') buckets.artists.push(shelf);
          else if (type === 'album' || cls === 'album') buckets.albums.push(shelf);
          else if (type === 'playlist' || cls === 'playlist') buckets.playlists.push(shelf);
          else if (type === 'track' || cls === 'track' || cls === 'music' || type === 'music') buckets.tracks.push(shelf);
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
    DATA.libraryLoaded = true;

    SonosStore.update(() => {});

    window.MA = {
      browseEntity: entityId,
      search: (q) => searchViaMediaPlayer(ha, entityId, q),
      browse: async (mediaContentId, mediaType) => {
        const result = await browse(ha, entityId, mediaContentId, mediaType);
        return (result?.children || []).map(shelfFromBrowseNode);
      },
    };

    window.haDebug = {
      client: ha,
      browseEntity: entityId,
      browseRoot: () => ha.callWS({ type: 'media_player/browse_media', entity_id: entityId }),
      browse: (mediaContentId, mediaType) => ha.callWS({
        type: 'media_player/browse_media', entity_id: entityId,
        media_content_id: mediaContentId, media_content_type: mediaType,
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
        // Mark both entities pending so the next ~3s of state_changed
        // events don't blow away the optimistic group we're about to set.
        markPendingGroup(roomA);
        markPendingGroup(roomB);
        SonosStore.update((s) => {
          const a = s.rooms[roomA]; const b = s.rooms[roomB];
          if (!a || !b) return;
          const gid = a.groupId || b.groupId || roomA;
          a.groupId = gid; b.groupId = gid;
          if (a.trackId) { b.trackId = a.trackId; b.playing = a.playing; }
        });
        ha.callService('media_player', 'join', {
          entity_id: roomA, group_members: [roomB],
        });
      },
      ungroup(roomId) {
        SonosStore.update((s) => {
          const room = s.rooms[roomId];
          if (!room) return;
          const oldGid = room.groupId;
          markPendingGroup(roomId);
          room.groupId = null;
          // If the group is now down to a single member, dissolve it too —
          // a "group" of one isn't a group, and HA's state_changed echo will
          // reflect that too once it catches up.
          if (oldGid) {
            const remaining = Object.entries(s.rooms)
              .filter(([id, r]) => r.groupId === oldGid);
            if (remaining.length <= 1) {
              remaining.forEach(([id, r]) => {
                markPendingGroup(id);
                r.groupId = null;
              });
            } else {
              // Mark remaining members pending too so their group_members
              // reconcile doesn't snap the just-left member back in.
              remaining.forEach(([id]) => markPendingGroup(id));
            }
          }
        });
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
