// Sonos Remote — standalone Home Assistant panel.
// Connects to HA via long-lived token, mirrors Sonos / Music Assistant
// state into the Obsidian UI. Renders desktop layout on iPad and any
// viewport >= 700px; mobile otherwise.

const isIpad = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad/.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh but has touch support.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
})();

function useViewport() {
  const read = () => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const onResize = () => setVp(read());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}

const THEME_KEY = 'sonos-remote-theme';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return 'dark';
  });
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    document.documentElement.style.background = theme === 'dark' ? '#000' : '#f4f3ef';
  }, [theme]);
  return [theme, setTheme];
}

function ConnectingScreen({ status }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#000', color: '#fff',
      display: 'grid', placeItems: 'center',
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 44, height: 44, margin: '0 auto 18px',
          borderRadius: 999, border: '2px solid rgba(255,255,255,.2)',
          borderTopColor: '#fff',
          animation: 'spin 900ms linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>
          {status === 'connecting' ? 'Connecting to Home Assistant…' : 'Loading rooms…'}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useTheme();
  const { w: vw, h: vh } = useViewport();
  // iPad → desktop only in landscape; portrait gets the mobile column.
  // Other devices → desktop at >= 900px (the 3-column hero layout needs
  // room to breathe — narrower viewports like a Fold unfolded get the
  // cleaner single-column layout instead).
  const isMobile = isIpad ? vw <= vh : vw < 900;
  const store = useSonos();
  const roomCount = Object.keys(store.rooms).length;

  const [config, setConfig] = useState(() => loadSetup());
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const haRef = useRef(null);

  // Reset hash → wipe stored creds.
  useEffect(() => {
    if (window.location.hash === '#reset') {
      clearSetup();
      window.location.hash = '';
      setConfig({ url: window.location.origin, token: '' });
    }
  }, []);

  // On first mount, check for a server-side auth.json (drop one in
  // /config/www/sonos-remote/auth.json with { url, token }) so every
  // device that loads the dashboard auto-authenticates without having
  // to paste a token. Server file always wins over localStorage so
  // updating the token on the server propagates everywhere.
  useEffect(() => {
    let cancelled = false;
    fetch('./auth.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.token) return;
        const url = data.url || window.location.origin;
        if (config.token === data.token && config.url === url) return;
        saveSetup({ url, token: data.token });
        setConfig({ url, token: data.token });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config.token) { setStatus('idle'); return; }
    let cancelled = false;
    setError(null);
    setStatus('connecting');
    startHaBridge({
      url: config.url,
      token: config.token,
      onStatus: (s) => !cancelled && setStatus(s),
    }).then((ha) => {
      haRef.current = ha;
    }).catch((e) => {
      if (cancelled) return;
      setError(e?.message || String(e));
      setStatus('error');
    });
    return () => {
      cancelled = true;
      try { haRef.current?.stop(); } catch (e) {}
      haRef.current = null;
    };
  }, [config.url, config.token]);

  if (!config.token || status === 'auth_invalid' || status === 'error') {
    return <SetupScreen
      initialUrl={config.url}
      initialError={status === 'auth_invalid' ? 'auth_invalid' : (error || null)}
      onSave={({ url, token }) => {
        saveSetup({ url, token });
        setConfig({ url, token });
        setError(null);
      }} />;
  }

  if (status !== 'connected' || roomCount === 0) {
    return <ConnectingScreen status={status} />;
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return isMobile
    ? <ObsidianMobile theme={theme} bgStyle="halo" onThemeToggle={toggle} />
    : <Obsidian theme={theme} bgStyle="halo" onThemeToggle={toggle} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
