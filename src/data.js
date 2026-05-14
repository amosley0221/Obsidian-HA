// Mock data for the Sonos remote dashboard.
// All "album art" is generated procedurally — pure CSS gradients keyed off
// a hash of the title, so we never ship copyrighted artwork.

window.SONOS_DATA = (() => {
  // Deterministic hash → hue.
  const hashHue = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  };

  // Generate a 2-color album gradient with an optional accent dot.
  // Returns a CSS background string + a "dominant" color we can sample for
  // the dynamic glow behind the Now Playing hero.
  const makeArt = (title, opts = {}) => {
    const hue = hashHue(title);
    const hue2 = (hue + (opts.spread ?? 50)) % 360;
    const L1 = opts.L1 ?? 0.62;
    const L2 = opts.L2 ?? 0.32;
    const C = opts.C ?? 0.14;
    const c1 = `oklch(${L1} ${C} ${hue})`;
    const c2 = `oklch(${L2} ${C * 0.9} ${hue2})`;
    return {
      bg: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      dominant: c1,
      shadow: c2,
      hue,
    };
  };

  // —— Rooms (zones) ——
  const rooms = [
    { id: 'living',  name: 'Living Room',  product: 'Arc Ultra',   icon: 'sofa' },
    { id: 'office',  name: 'Office',       product: 'Era 300',     icon: 'desk' },
    { id: 'bedroom', name: 'Bedroom',      product: 'Era 100',     icon: 'bed' },
    { id: 'dining',  name: 'Dining Room',  product: 'Beam (Gen 2)', icon: 'fork' },
    { id: 'bath',    name: 'Bathroom',     product: 'Roam 2',      icon: 'drop' },
    { id: 'garage',  name: 'Garage',       product: 'Five',        icon: 'wrench' },
    { id: 'move',    name: 'Move 2',       product: 'Move 2',      icon: 'portable' },
  ];

  // —— Tracks (originals — no real songs) ——
  // Title/Artist/Album are made up. Durations in seconds.
  const tracks = [
    { id: 't1', title: 'Slow Light Through Glass',  artist: 'Aoife Lennox',         album: 'North of Anywhere',  duration: 264, art: makeArt('North of Anywhere') },
    { id: 't2', title: 'Cassette Memory',           artist: 'Marrow & The Tide',    album: 'Hours Between Rooms',duration: 198, art: makeArt('Hours Between Rooms') },
    { id: 't3', title: 'Wide Pacific Static',       artist: 'Calder Vance',         album: 'Pelagic',            duration: 312, art: makeArt('Pelagic', { spread: 80 }) },
    { id: 't4', title: 'Telegraph Hill',            artist: 'Brimwood',             album: 'Late Wires',         duration: 221, art: makeArt('Late Wires') },
    { id: 't5', title: 'Saudade in B Minor',        artist: 'Ana Cordeiro',         album: 'Lisboa, 4am',        duration: 287, art: makeArt('Lisboa, 4am', { spread: 30 }) },
    { id: 't6', title: 'Garage Door Symphony',      artist: 'The Halftones',        album: 'Civics',             duration: 175, art: makeArt('Civics') },
    { id: 't7', title: 'Kitchen at Midnight',       artist: 'Yusra Park',           album: 'Small Domestic',     duration: 244, art: makeArt('Small Domestic') },
    { id: 't8', title: 'Cantilever',                artist: 'Doss & Reyes',         album: 'Bridges',            duration: 312, art: makeArt('Bridges', { spread: 110 }) },
    { id: 't9', title: 'Marigold Static',           artist: 'June Hollow',          album: 'Pollen Count',       duration: 198, art: makeArt('Pollen Count') },
    { id: 't10',title: 'Aluminium Dreams',          artist: 'Soft Engine',          album: 'Quiet Industry',     duration: 263, art: makeArt('Quiet Industry') },
  ];

  // —— Library shelves ——
  const playlists = [
    { id: 'p1', title: 'Sunday Reset',            count: 42, art: makeArt('Sunday Reset') },
    { id: 'p2', title: 'Slow Mornings',           count: 28, art: makeArt('Slow Mornings') },
    { id: 'p3', title: 'Deep Focus',              count: 64, art: makeArt('Deep Focus') },
    { id: 'p4', title: 'Late Drives',             count: 31, art: makeArt('Late Drives') },
    { id: 'p5', title: 'Kitchen Jazz',            count: 53, art: makeArt('Kitchen Jazz') },
    { id: 'p6', title: 'Acoustic & Honest',       count: 47, art: makeArt('Acoustic & Honest') },
  ];

  const albums = [
    { id: 'a1', title: 'North of Anywhere', artist: 'Aoife Lennox',      art: makeArt('North of Anywhere') },
    { id: 'a2', title: 'Hours Between Rooms', artist: 'Marrow & The Tide', art: makeArt('Hours Between Rooms') },
    { id: 'a3', title: 'Pelagic',           artist: 'Calder Vance',      art: makeArt('Pelagic', { spread: 80 }) },
    { id: 'a4', title: 'Late Wires',        artist: 'Brimwood',          art: makeArt('Late Wires') },
    { id: 'a5', title: 'Lisboa, 4am',       artist: 'Ana Cordeiro',      art: makeArt('Lisboa, 4am', { spread: 30 }) },
    { id: 'a6', title: 'Civics',            artist: 'The Halftones',     art: makeArt('Civics') },
    { id: 'a7', title: 'Small Domestic',    artist: 'Yusra Park',        art: makeArt('Small Domestic') },
    { id: 'a8', title: 'Bridges',           artist: 'Doss & Reyes',      art: makeArt('Bridges', { spread: 110 }) },
  ];

  const stations = [
    { id: 's1', title: 'Bay Area Pop',  art: makeArt('Bay Area Pop') },
    { id: 's2', title: 'Lofi Hours',    art: makeArt('Lofi Hours', { L1: 0.7, C: 0.10 }) },
    { id: 's3', title: 'Saturday Soul', art: makeArt('Saturday Soul') },
    { id: 's4', title: 'Coast Highway', art: makeArt('Coast Highway', { spread: 90 }) },
  ];

  const recents = [
    { id: 'r1', title: 'Hours Between Rooms', subtitle: 'Marrow & The Tide · Album',  art: makeArt('Hours Between Rooms') },
    { id: 'r2', title: 'Slow Mornings',       subtitle: 'Apple Music · Playlist',     art: makeArt('Slow Mornings') },
    { id: 'r3', title: 'Pelagic',             subtitle: 'Calder Vance · Album',       art: makeArt('Pelagic', { spread: 80 }) },
    { id: 'r4', title: 'Deep Focus',          subtitle: 'Apple Music · Playlist',     art: makeArt('Deep Focus') },
    { id: 'r5', title: 'Late Drives',         subtitle: 'Apple Music · Playlist',     art: makeArt('Late Drives') },
  ];

  // —— Initial room state (what's playing where) ——
  // Living + Kitchen-like grouping for demo. Group id = stable string.
  const initialRoomState = {
    living:  { volume: 36, playing: true,  trackId: 't1', source: 'apple-music', groupId: 'g1' },
    office:  { volume: 22, playing: true,  trackId: 't3', source: 'apple-music', groupId: null },
    bedroom: { volume: 18, playing: false, trackId: 't5', source: 'apple-music', groupId: null },
    dining:  { volume: 42, playing: true,  trackId: 't1', source: 'apple-music', groupId: 'g1' },
    bath:    { volume: 28, playing: false, trackId: null, source: 'apple-music', groupId: null },
    garage:  { volume: 55, playing: false, trackId: null, source: 'line-in',     groupId: null },
    move:    { volume: 30, playing: false, trackId: null, source: 'airplay',     groupId: null },
  };

  return {
    rooms, tracks, playlists, albums, stations, recents,
    initialRoomState,
    helpers: { makeArt, hashHue },
  };
})();
