// Minimal stroke icon set for the Sonos remote.
// All icons are 24×24 viewBox, currentColor, stroke-based — they live
// inside text and inherit color/size from context.

const Icon = ({ d, size = 20, stroke = 1.5, fill = 'none', ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
       fill={fill} stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const Icons = {
  Play:    (p) => <Icon {...p} fill="currentColor" stroke="none" d="M7 5.5v13l11-6.5L7 5.5Z" />,
  Pause:   (p) => <Icon {...p} fill="currentColor" stroke="none" d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />,
  Prev:    (p) => <Icon {...p} fill="currentColor" stroke="none" d="M6 5v14h2V5H6Zm14 0L9 12l11 7V5Z" />,
  Next:    (p) => <Icon {...p} fill="currentColor" stroke="none" d="M4 5v14l11-7L4 5Zm12 0v14h2V5h-2Z" />,
  Shuffle: (p) => <Icon {...p} d={
    <>
      <path d="M3 7h3l11 10h4" />
      <path d="M3 17h3l4-3.6" />
      <path d="M14 10.6L17 7h4" />
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </>
  } />,
  Repeat:  (p) => <Icon {...p} d={
    <>
      <path d="M4 12V9a3 3 0 0 1 3-3h11" />
      <path d="M15 3l3 3-3 3" />
      <path d="M20 12v3a3 3 0 0 1-3 3H6" />
      <path d="M9 21l-3-3 3-3" />
    </>
  } />,
  VolMin:  (p) => <Icon {...p} d="M4 10v4h3l4 3V7L7 10H4Z" fill="currentColor" stroke="none" />,
  VolMax:  (p) => <Icon {...p} d={
    <>
      <path d="M3 10v4h3l4 3V7L6 10H3Z" fill="currentColor" stroke="none" />
      <path d="M14 8.5c1.6 1 1.6 6 0 7M16.5 6c3 2 3 8 0 10" />
    </>
  } />,
  Search:  (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>} />,
  Heart:   (p) => <Icon {...p} d="M12 20.5s-7.5-4.6-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 3.5c0 5.4-7.5 10-7.5 10Z" />,
  HeartFill:(p)=> <Icon {...p} fill="currentColor" stroke="currentColor" d="M12 20.5s-7.5-4.6-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 3.5c0 5.4-7.5 10-7.5 10Z" />,
  Queue:   (p) => <Icon {...p} d={
    <>
      <path d="M4 7h12M4 12h12M4 17h8" />
      <path d="M18 14l4 3-4 3v-6Z" fill="currentColor" stroke="none" />
    </>
  } />,
  More:    (p) => <Icon {...p} stroke="none" d={
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  } />,
  AirPlay: (p) => <Icon {...p} d={<><path d="M5 17a8 8 0 0 1 14 0" /><path d="M8 19l4-4 4 4H8Z" fill="currentColor" stroke="currentColor" /></>} />,
  Group:   (p) => <Icon {...p} d={
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
      <path d="M11 7h2a2 2 0 0 1 2 2v2" />
    </>
  } />,
  Sliders: (p) => <Icon {...p} d={
    <>
      <path d="M4 7h6M14 7h6M4 17h12M16 14v6" />
      <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="2" fill="currentColor" stroke="none" />
    </>
  } />,
  Mic:     (p) => <Icon {...p} d={<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>} />,
  Down:    (p) => <Icon {...p} d="M6 9l6 6 6-6" />,
  Up:      (p) => <Icon {...p} d="M6 15l6-6 6 6" />,
  Close:   (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  Plus:    (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  Speaker: (p) => <Icon {...p} d={
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <circle cx="12" cy="14.5" r="3" />
      <circle cx="12" cy="6.5" r=".9" fill="currentColor" stroke="none" />
    </>
  } />,
  // Room glyphs — used in some directions as room ID.
  Sofa:   (p)=> <Icon {...p} d="M3 13v5M21 13v5M3 13a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v3H3v-3Zm3-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" />,
  Bed:    (p)=> <Icon {...p} d="M3 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 16h18M7 10V7h6v3" />,
  Desk:   (p)=> <Icon {...p} d="M3 9h18v3H3zM5 12v8M19 12v8M9 12v3h6v-3" />,
  Fork:   (p)=> <Icon {...p} d="M7 3v6a2 2 0 0 0 2 2v10M5 3v4a2 2 0 0 0 2 2M15 3h2a2 2 0 0 1 2 2v6h-3v10" />,
  Drop:   (p)=> <Icon {...p} d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" />,
  Wrench: (p)=> <Icon {...p} d="M14 7a4 4 0 0 1 5.5 5L21 13.5 17 9.5 14 7Zm0 0L4 17l3 3 10-10" />,
  Portable:(p)=> <Icon {...p} d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3Zm-1 8h10" />,
};

const RoomIcon = ({ id, ...rest }) => {
  const map = {
    sofa: Icons.Sofa, bed: Icons.Bed, desk: Icons.Desk, fork: Icons.Fork,
    drop: Icons.Drop, wrench: Icons.Wrench, portable: Icons.Portable,
  };
  const C = map[id] || Icons.Speaker;
  return <C {...rest} />;
};

Object.assign(window, { Icon, Icons, RoomIcon });
