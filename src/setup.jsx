// First-run setup overlay. Asks for HA URL + long-lived access token,
// stores them in localStorage. Also shown when auth is invalid.

const SETUP_KEYS = { url: 'sonos-ha-url', token: 'sonos-ha-token' };

function loadSetup() {
  try {
    return {
      url: localStorage.getItem(SETUP_KEYS.url) || window.location.origin,
      token: localStorage.getItem(SETUP_KEYS.token) || '',
    };
  } catch (e) {
    return { url: window.location.origin, token: '' };
  }
}

function saveSetup({ url, token }) {
  try {
    localStorage.setItem(SETUP_KEYS.url, url);
    localStorage.setItem(SETUP_KEYS.token, token);
  } catch (e) {}
}

function clearSetup() {
  try {
    localStorage.removeItem(SETUP_KEYS.url);
    localStorage.removeItem(SETUP_KEYS.token);
  } catch (e) {}
}

function SetupScreen({ initialUrl, initialError, onSave }) {
  const [url, setUrl] = useState(initialUrl || window.location.origin);
  const [token, setToken] = useState('');
  const error = initialError;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#000', color: '#fff',
      display: 'grid', placeItems: 'center',
      padding: 24,
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ff7e60' }}>
          Sonos Remote · Setup
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Connect to Home Assistant
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>
          Generate a long-lived access token in your HA profile (bottom of the
          Security tab) and paste it here. URL defaults to the page origin —
          override only if HA lives somewhere else.
        </p>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,90,80,.15)', border: '0.5px solid rgba(255,90,80,.4)',
            fontSize: 13, color: '#ffb3a8',
          }}>
            {error === 'auth_invalid' && 'Token rejected. Double-check the token.'}
            {error === 'no_rooms' && 'Connected, but no Sonos or Music Assistant media_players were discovered.'}
            {error !== 'auth_invalid' && error !== 'no_rooms' && `Connection failed: ${error}`}
          </div>
        )}

        <label style={lbl}>Home Assistant URL</label>
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://homeassistant.local:8123"
          style={input}
        />

        <label style={lbl}>Long-lived access token</label>
        <textarea
          value={token} onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJI…"
          rows={4}
          style={{ ...input, fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.4 }}
        />

        <button
          onClick={() => onSave({ url: url.trim(), token: token.trim() })}
          disabled={!url.trim() || !token.trim()}
          style={{
            marginTop: 20, width: '100%', padding: '14px 16px',
            border: 0, borderRadius: 14,
            background: '#fff', color: '#000', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            opacity: !url.trim() || !token.trim() ? 0.4 : 1,
          }}>
          Connect
        </button>

        <p style={{ marginTop: 16, fontSize: 11.5, color: 'rgba(255,255,255,.42)', lineHeight: 1.5 }}>
          Saved locally on this device only — not sent anywhere else. To
          re-enter, append <code style={{ color: 'rgba(255,255,255,.7)' }}>#reset</code>
          to the URL.
        </p>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block', marginTop: 18, marginBottom: 6,
  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,.55)',
};
const input = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,.06)',
  border: '0.5px solid rgba(255,255,255,.15)',
  borderRadius: 12, color: '#fff', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
};

Object.assign(window, { SetupScreen, loadSetup, saveSetup, clearSetup });
