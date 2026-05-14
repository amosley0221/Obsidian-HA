// Sonos Remote — standalone Home Assistant panel.
// Renders the Obsidian direction full-bleed: dark by default with a light
// option. Switches between desktop and mobile layouts based on viewport.
// Accent color derives from the currently-playing album art.

function useViewport() {
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vw;
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

function App() {
  const [theme, setTheme] = useTheme();
  const vw = useViewport();
  const isMobile = vw < 760;
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return isMobile
    ? <ObsidianMobile theme={theme} bgStyle="halo" onThemeToggle={toggle} />
    : <Obsidian theme={theme} bgStyle="halo" onThemeToggle={toggle} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
