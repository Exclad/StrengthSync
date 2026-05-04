// Screen: Settings — timezone default, export filename, output folder, DB reset
const { useState, useEffect, useMemo, useRef } = React;

function ScreenSettings({ onBack, setPage }) {
  const [timezones, setTimezones] = useState([]);
  const [tzFilter, setTzFilter] = useState('');
  const [tzOpen, setTzOpen] = useState(false);
  const [savedTz, setSavedTz] = useState(() => localStorage.getItem('ss-timezone') || '');
  const [filenamePattern, setFilenamePattern] = useState(() => localStorage.getItem('ss-filename-pattern') || '{date}_{workout}.fit');
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('ss-output-folder') || 'output/');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [mappingCount, setMappingCount] = useState(0);
  const [savedMsg, setSavedMsg] = useState('');
  const tzWrapRef = useRef(null);

  // Phase 7: Hevy API settings (Group E) + cache warning
  const [hevyApiKey, setHevyApiKey] = useState(() => localStorage.getItem('ss-hevy-api-key') || '');
  const [cacheWarningDays, setCacheWarningDays] = useState(
    () => parseInt(localStorage.getItem('ss-cache-warning-days') || '7', 10)
  );
  const [apiTestResult, setApiTestResult] = useState(null);  // null | {ok, reason}
  const [apiTesting, setApiTesting] = useState(false);

  const showSaved = (msg = 'Saved') => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  // Close timezone dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (tzWrapRef.current && !tzWrapRef.current.contains(e.target)) {
        setTzOpen(false);
        setTzFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    const t = setTimeout(() => { localStorage.setItem('ss-filename-pattern', filenamePattern); showSaved('Filename pattern saved'); }, 300);
    return () => clearTimeout(t);
  }, [filenamePattern]);

  const filteredTz = useMemo(() => {
    if (!tzFilter) return timezones;
    return timezones.filter(tz => tz.toLowerCase().includes(tzFilter.toLowerCase()));
  }, [timezones, tzFilter]);

  const eyebrowStyle = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--ink-2)',
    marginBottom: 6,
  };

  const descStyle = {
    fontSize: 14,
    color: 'var(--ink-2)',
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

          {/* Custom combobox */}
          <div style={{ position: 'relative' }} ref={tzWrapRef}>
            <button
              onClick={() => { setTzOpen(o => !o); setTzFilter(''); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
                border: `1px solid ${tzOpen ? 'var(--accent-2)' : 'var(--line)'}`,
                background: tzOpen ? 'var(--surface-2)' : 'var(--surface)',
                color: savedTz ? 'var(--ink)' : 'var(--ink-3)',
                boxSizing: 'border-box', transition: 'border-color .15s, background .15s',
                boxShadow: tzOpen ? '0 0 0 3px color-mix(in oklab, var(--accent-2) 18%, transparent)' : 'none',
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13 }}>
                {savedTz || 'Select timezone…'}
              </span>
              <IconChevDown size={14} style={{ color: 'var(--ink-3)', flexShrink: 0, transform: tzOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}/>
            </button>

            {tzOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
                borderRadius: 12, border: '1px solid var(--line)',
                background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
                overflow: 'hidden',
              }}>
                <div className="row" style={{ gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                  <IconSearch size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search timezones…"
                    value={tzFilter}
                    onChange={e => setTzFilter(e.target.value)}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', font: 'inherit', color: 'var(--ink)', fontSize: 13 }}
                  />
                  {tzFilter && <button onClick={() => setTzFilter('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {filteredTz.map(tz => {
                    const selected = tz === savedTz;
                    return (
                      <button key={tz} onClick={() => { setSavedTz(tz); localStorage.setItem('ss-timezone', tz); setTzOpen(false); setTzFilter(''); showSaved('Timezone saved'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', textAlign: 'left', padding: '9px 14px',
                          border: 'none', cursor: 'pointer', font: 'inherit',
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13,
                          background: selected ? 'color-mix(in oklab, var(--accent-2) 10%, var(--surface))' : 'transparent',
                          color: selected ? 'var(--ink)' : 'var(--ink-2)',
                        }}>
                        <span style={{ width: 14, flexShrink: 0 }}>{selected && <IconCheck size={12} style={{ color: 'var(--good)' }}/>}</span>
                        {tz}
                      </button>
                    );
                  })}
                  {filteredTz.length === 0 && (
                    <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No timezones match "{tzFilter}"</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detected && timezones.includes(detected)) {
                  setSavedTz(detected);
                  localStorage.setItem('ss-timezone', detected);
                  showSaved('Browser timezone detected');
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
            onBlur={() => { localStorage.setItem('ss-output-folder', outputFolder); showSaved('Output folder saved'); }}
            placeholder="output/"
            style={inputStyle}
          />
          <div style={{ marginTop: 8 }}>
            <span className="chip neutral mono" style={{ fontSize: 10 }}>{outputFolder || 'output/'}</span>
          </div>

          {/* Phase 7 D-03: CSV cache freshness warning threshold */}
          <div style={{ height: 1, background: 'var(--line)', margin: '16px 0' }} />
          <div style={eyebrowStyle}>CSV CACHE WARNING</div>
          <div style={descStyle}>Show an outdated warning on the Upload screen when the cached Hevy export is older than this many days.</div>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              aria-label="Cache warning threshold in days"
              value={cacheWarningDays}
              onChange={e => setCacheWarningDays(parseInt(e.target.value, 10) || 7)}
              onBlur={() => { localStorage.setItem('ss-cache-warning-days', String(cacheWarningDays)); showSaved('Cache warning threshold saved'); }}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>days</span>
          </div>
        </div>

        {/* Group E: Hevy API (Beta) — Phase 7 D-05 */}
        <div className="card" style={{ padding: 24 }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0 }}>HEVY API</div>
            <span className="chip neutral" style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.1em' }}>BETA</span>
          </div>
          <div style={descStyle}>Enter your Hevy API key to fetch workout history directly from the app.</div>
          {/* API disclaimer */}
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <IconWarn size={14} style={{ color: 'var(--ink-2)', flexShrink: 0, marginTop: 1 }}/>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Hevy's API is unofficial and may change without notice.
            </span>
          </div>
          {/* API key input */}
          <input
            type="text"
            placeholder="Paste your API key here…"
            value={hevyApiKey}
            onChange={e => setHevyApiKey(e.target.value)}
            onBlur={() => localStorage.setItem('ss-hevy-api-key', hevyApiKey)}
            style={inputStyle}
          />
          {/* Test connection button + result chip */}
          <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={apiTesting || !hevyApiKey.trim()}
              onClick={async () => {
                setApiTesting(true);
                setApiTestResult(null);
                try {
                  const r = await fetch('/api/hevy/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: hevyApiKey }),
                  });
                  const body = await r.json();
                  setApiTestResult(body);
                } catch {
                  setApiTestResult({ ok: false, reason: 'unreachable' });
                }
                setApiTesting(false);
              }}
            >
              {apiTesting ? 'Testing…' : 'Test connection'}
            </button>
            {apiTestResult && !apiTesting && (
              apiTestResult.ok ? (
                <span className="chip good" style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconCheck size={10}/> CONNECTED
                </span>
              ) : (
                <span className="chip bad" style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.1em' }}>
                  {apiTestResult.reason === 'invalid_key' ? 'INVALID KEY'
                    : apiTestResult.reason === 'rate_limited' ? 'RATE LIMITED'
                    : 'UNREACHABLE'}
                </span>
              )
            )}
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

      {savedMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, fontSize: 12, color: 'var(--good)', fontFamily: 'var(--font-mono)' }}>
          ✓ {savedMsg}
        </div>
      )}

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
