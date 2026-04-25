// Screen: Settings — timezone default, export filename, output folder, DB reset
const { useState, useEffect, useMemo, useRef } = React;

function ScreenSettings({ onBack, setPage }) {
  const [timezones, setTimezones] = useState([]);
  const [tzFilter, setTzFilter] = useState('');
  const [savedTz, setSavedTz] = useState(() => localStorage.getItem('ss-timezone') || '');
  const [filenamePattern, setFilenamePattern] = useState(() => localStorage.getItem('ss-filename-pattern') || '{date}_{workout}.fit');
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('ss-output-folder') || 'output/');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [mappingCount, setMappingCount] = useState(0);

  // Fetch timezones for Group A
  useEffect(() => {
    fetch('/api/timezones').then(r => r.json()).then(setTimezones).catch(() => {});
  }, []);

  // Fetch current mapping count for modal body text
  useEffect(() => {
    fetch('/api/mappings').then(r => r.json()).then(d => setMappingCount(d.length)).catch(() => {});
  }, [resetSuccess]);

  // Debounce filename pattern persistence
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('ss-filename-pattern', filenamePattern), 300);
    return () => clearTimeout(t);
  }, [filenamePattern]);

  const filteredTz = useMemo(() => {
    if (!tzFilter) return timezones;
    return timezones.filter(tz => tz.toLowerCase().includes(tzFilter.toLowerCase()));
  }, [timezones, tzFilter]);

  const eyebrowStyle = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    marginBottom: 6,
  };

  const descStyle = {
    fontSize: 13,
    color: 'var(--ink-3)',
    marginBottom: 12,
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    fontSize: 13,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 32 }}>
        <p className="h-eyebrow" style={{ marginBottom: 4 }}>SETTINGS / PREFERENCES</p>
        <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>Your preferences.</h1>
      </div>

      {/* Cards stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Group A: Timezone Default */}
        <div className="card" style={{ padding: 24 }}>
          <div style={eyebrowStyle}>TIMEZONE DEFAULT</div>
          <div style={descStyle}>Pre-fills the timezone picker on the Upload screen. Auto-detected from your browser when not set.</div>
          <input
            type="text"
            placeholder="Filter timezones…"
            value={tzFilter}
            onChange={e => setTzFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          <select
            value={savedTz}
            onChange={e => { setSavedTz(e.target.value); localStorage.setItem('ss-timezone', e.target.value); }}
            size={5}
            style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, padding: 4 }}
          >
            {filteredTz.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detected && timezones.includes(detected)) {
                  setSavedTz(detected);
                  localStorage.setItem('ss-timezone', detected);
                }
              }}
            >Use browser timezone</button>
            {savedTz && (
              <span style={{ fontSize: 12, color: 'var(--good)', fontFamily: "'JetBrains Mono', ui-monospace, monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconCheck size={12}/> {savedTz}
              </span>
            )}
          </div>
        </div>

        {/* Group B: Export Filename */}
        <div className="card" style={{ padding: 24 }}>
          <div style={eyebrowStyle}>EXPORT FILENAME</div>
          <div style={descStyle}>Customize the output filename. Use {'{date}'} for workout date and {'{workout}'} for workout name.</div>
          <input
            type="text"
            value={filenamePattern}
            onChange={e => setFilenamePattern(e.target.value)}
            style={inputStyle}
          />
          <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>PREVIEW</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {filenamePattern
                .replace('{date}', new Date().toISOString().slice(0, 10))
                .replace('{workout}', 'Strength_Training')}
            </div>
          </div>
        </div>

        {/* Group C: Output Folder */}
        <div className="card" style={{ padding: 24 }}>
          <div style={eyebrowStyle}>OUTPUT FOLDER</div>
          <div style={descStyle}>Path where merged FIT files are saved. Defaults to the output/ folder inside the app directory.</div>
          <input
            type="text"
            value={outputFolder}
            onChange={e => setOutputFolder(e.target.value)}
            onBlur={() => localStorage.setItem('ss-output-folder', outputFolder)}
            placeholder="output/"
            style={inputStyle}
          />
          <div style={{ marginTop: 8 }}>
            <span className="chip neutral mono" style={{ fontSize: 10 }}>{outputFolder || 'output/'}</span>
          </div>
        </div>

        {/* Group D: Danger Zone */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ ...eyebrowStyle, color: 'var(--bad)' }}>DANGER ZONE</div>
          <div style={descStyle}>Permanently deletes all saved exercise mappings. Future syncs will need to re-map exercises from scratch.</div>
          {resetSuccess ? (
            <span className="chip good" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={12}/> All mappings cleared.</span>
          ) : (
            <button
              className="btn"
              style={{ background: 'color-mix(in oklab, var(--bad) 15%, var(--surface))', color: 'var(--bad)', border: '1px solid color-mix(in oklab, var(--bad) 30%, var(--line))', borderRadius: 10 }}
              onClick={() => { setShowResetModal(true); setResetError(null); }}
            >
              Clear all exercise mappings
            </button>
          )}
          {resetError && (
            <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginTop: 10 }}>
              <IconWarn size={14}/><span style={{ fontSize: 13 }}>{resetError}</span>
            </div>
          )}
        </div>

      </div>

      {/* DB reset confirmation modal */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ padding: 28, maxWidth: 380, width: '90%' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Clear all exercise mappings?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
              This will permanently delete all {mappingCount} saved mappings. Future syncs will re-map exercises from scratch. This cannot be undone.
            </div>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowResetModal(false)}>Keep my mappings</button>
              <button
                className="btn"
                style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
                disabled={resetLoading}
                onClick={async () => {
                  setResetLoading(true);
                  try {
                    const r = await fetch('/api/map/reset', { method: 'POST' });
                    if (!r.ok) throw new Error('failed');
                    setResetSuccess(true);
                    setShowResetModal(false);
                  } catch {
                    setResetError("Couldn't clear mappings. Check the app is still running and try again.");
                    setShowResetModal(false);
                  }
                  setResetLoading(false);
                }}
              >
                {resetLoading ? 'Clearing…' : 'Clear all mappings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.ScreenSettings = ScreenSettings;
