// Screen 1 — Upload & connect
function ScreenUpload({ onNext, state, update, setPage }) {
  const fitInput = useRef(null);
  const hevyInput = useRef(null);

  const [timezones, setTimezones] = useState([]);
  const [timezone, setTimezone] = useState('');
  const [tzFilter, setTzFilter] = useState('');
  const [tzOpen, setTzOpen] = useState(false);
  const [tzSource, setTzSource] = useState(null); // null | 'auto' | 'saved'
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const tzWrapRef = useRef(null);

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

  // Fetch timezone list on mount, then auto-detect or restore saved timezone
  useEffect(() => {
    fetch('/api/timezones')
      .then(r => r.json())
      .then(data => {
        setTimezones(data);
        // Auto-detect timezone
        const saved = localStorage.getItem('ss-timezone');
        if (saved && data.includes(saved)) {
          setTimezone(saved);
          setTzSource('saved');
        } else {
          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (detected && data.includes(detected)) {
            setTimezone(detected);
            setTzSource('auto');
          }
        }
      })
      .catch(() => setTimezones([]));
  }, []);

  const addFiles = (files) => {
    const newFiles = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name || "Strength_Training_2026-04-18.fit",
      size: f.size || 184320,
      date: fmtDate(new Date().toISOString()),
      _file: f,  // store original File for FormData
    }));
    update({ fitFiles: [...state.fitFiles, ...newFiles] });
  };

  const onDrop = (e) => {
    e.preventDefault();
    update({ dragging: false });
    addFiles(e.dataTransfer.files);
  };

  const canContinue = state.fitFiles.length > 0 && state.hevyFile && timezone && !uploading;

  const handleContinue = async () => {
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('fit_file', state.fitFiles[0]._file);
    if (state.hevyFile) formData.append('hevy_csv', state.hevyFile);
    formData.append('timezone', timezone);

    try {
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await resp.json();
      if (!resp.ok) {
        const rawError = body.error || '';
        let msg;
        if (rawError.toLowerCase().includes('fit') && (rawError.toLowerCase().includes('parse') || rawError.toLowerCase().includes('invalid'))) {
          msg = "Couldn't read the FIT file. " + rawError + " Try exporting a fresh copy from Garmin Connect.";
        } else if (rawError.toLowerCase().includes('fit')) {
          msg = "That file doesn't look like a Garmin FIT file. Export from Garmin Connect → Activity → ⋯ → Export original.";
        } else if (rawError.toLowerCase().includes('csv') || rawError.toLowerCase().includes('hevy')) {
          msg = "The CSV doesn't match Hevy's export format. In Hevy: Profile → Settings → Export Workout Data → Download.";
        } else if (rawError) {
          msg = rawError;
        } else {
          msg = "That file doesn't look like a Garmin FIT file. Export from Garmin Connect → Activity → ⋯ → Export original.";
        }
        setUploadError(msg);
        setUploading(false);
        return;
      }
      update({ timezone, uploadResult: body });
      localStorage.setItem('ss-timezone', timezone);
      onNext(body);
    } catch (err) {
      setUploadError('Network error. Is the app running?');
      setUploading(false);
    }
    setUploading(false);
  };

  return (
    <div>
      <p className="h-eyebrow">STEP 01 / IMPORT</p>
      <h1 className="h-display">Bring your workouts <em>together.</em></h1>
      <p className="h-sub">StrengthSync merges Hevy's exercise precision with your Garmin watch's biometrics. Drop your FIT files below, connect Hevy, and we'll handle the rest — locally, on your machine.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 20, marginTop: 36 }}>

        {/* FIT upload */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-2)", display: "grid", placeItems: "center" }}>
                <IconWatch size={16}/>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Garmin <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 500 }}>/ .fit</span></div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Download from Garmin Connect → Activity → ⋯ → Export original</div>
              </div>
            </div>
            <span className={`chip ${state.fitFiles.length ? "good" : "neutral"}`}>
              <span className="dot"></span>
              {state.fitFiles.length ? `${state.fitFiles.length} FILE${state.fitFiles.length > 1 ? "S" : ""}` : "NO FILES"}
            </span>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); update({ dragging: true }); }}
            onDragLeave={() => update({ dragging: false })}
            onDrop={onDrop}
            style={{
              margin: 22,
              border: `2px dashed ${state.dragging ? "var(--accent-2)" : "var(--line-2)"}`,
              background: state.dragging ? "color-mix(in oklab, var(--accent-2) 6%, var(--surface))" : "var(--surface-2)",
              borderRadius: 14,
              padding: "40px 28px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all .15s ease",
            }}
            onClick={() => fitInput.current?.click()}
          >
            <input ref={fitInput} type="file" multiple accept=".fit" style={{ display: "none" }}
              onChange={e => addFiles(e.target.files)} />
            <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: 14, background: "var(--bg)", display: "grid", placeItems: "center", border: "1px solid var(--line)" }}>
              <IconUpload size={22}/>
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
              Drop .fit files here
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
              Multiple files OK — batch-process a whole week at once.
            </div>
            <div className="row" style={{ justifyContent: "center", gap: 8 }}>
              <button className="btn btn-dark btn-sm" onClick={(e) => { e.stopPropagation(); fitInput.current?.click(); }}>Browse files</button>
            </div>
          </div>

          {state.fitFiles.length > 0 && (
            <div style={{ padding: "6px 22px 22px" }}>
              {state.fitFiles.map(f => (
                <div key={f.id} className="row" style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 10, marginTop: 8, background: "var(--surface-2)" }}>
                  <IconFile size={16}/>
                  <div className="grow">
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{f.date} · {(f.size/1024).toFixed(0)} KB</div>
                  </div>
                  <span className="chip good"><IconCheck size={10}/> PARSED</span>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => update({ fitFiles: state.fitFiles.filter(x => x.id !== f.id) })}>
                    <IconX size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hevy connect */}
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-2)", display: "grid", placeItems: "center" }}>
                <IconDumbbell size={16}/>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Hevy</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Workout source</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <IconFile size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }}/>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Export from <strong style={{ color: "var(--ink)" }}>Hevy Settings → Export</strong> then upload the CSV below.</span>
          </div>

          {true && (
            <div style={{ marginTop: 14, padding: 14, background: "var(--surface-2)", borderRadius: 10, border: "1px dashed var(--line-2)", textAlign: "center" }}>
              <input ref={hevyInput} type="file" accept=".csv" style={{ display: "none" }}
                onChange={e => { if (e.target.files[0]) update({ hevyFile: e.target.files[0] }); }} />
              <IconUpload size={18}/>
              {state.hevyFile ? (
                <div style={{ fontSize: 13, marginTop: 4, color: "var(--good)" }}>
                  <IconCheck size={12}/> {state.hevyFile.name}
                </div>
              ) : (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Drop hevy-export.csv
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); hevyInput.current?.click(); }}>Browse files</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grow"></div>

          <div style={{ marginTop: 18, padding: 12, background: "color-mix(in oklab, var(--accent) 12%, transparent)", borderRadius: 10, borderLeft: "3px solid var(--accent-2)" }}>
            <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <IconLock size={14} style={{ marginTop: 2, color: "var(--ink-2)" }}/>
              <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--ink)" }}>All processing happens locally.</strong> Your workout data never leaves your machine — FIT parsing, mapping, and merging all run in Python on localhost.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone selector — custom combobox */}
      <div style={{ marginTop: 16, position: 'relative' }} ref={tzWrapRef}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timezone</div>

        {/* Trigger */}
        <button
          onClick={() => { setTzOpen(o => !o); setTzFilter(''); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
            border: `1px solid ${tzOpen ? 'var(--accent-2)' : 'var(--line)'}`,
            background: tzOpen ? 'var(--surface-2)' : 'var(--surface)',
            color: timezone ? 'var(--ink)' : 'var(--ink-3)',
            boxSizing: 'border-box', transition: 'border-color .15s, background .15s',
            boxShadow: tzOpen ? '0 0 0 3px color-mix(in oklab, var(--accent-2) 18%, transparent)' : 'none',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {timezone || 'Select timezone…'}
          </span>
          <IconChevDown size={14} style={{ color: 'var(--ink-3)', flexShrink: 0, transform: tzOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}/>
        </button>

        {/* Dropdown panel */}
        {tzOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
            borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            overflow: 'hidden',
          }}>
            {/* Search row */}
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
              {tzFilter && (
                <button onClick={() => setTzFilter('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>
            {/* List */}
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {timezones
                .filter(tz => !tzFilter || tz.toLowerCase().includes(tzFilter.toLowerCase()))
                .map(tz => {
                  const selected = tz === timezone;
                  return (
                    <button
                      key={tz}
                      onClick={() => { setTimezone(tz); setTzOpen(false); setTzFilter(''); setTzSource('saved'); localStorage.setItem('ss-timezone', tz); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', textAlign: 'left', padding: '9px 14px',
                        border: 'none', cursor: 'pointer', font: 'inherit',
                        fontFamily: 'var(--font-mono)', fontSize: 13,
                        background: selected ? 'color-mix(in oklab, var(--accent-2) 10%, var(--surface))' : 'transparent',
                        color: selected ? 'var(--ink)' : 'var(--ink-2)',
                      }}
                    >
                      <span style={{ width: 14, flexShrink: 0 }}>
                        {selected && <IconCheck size={12} style={{ color: 'var(--good)' }}/>}
                      </span>
                      {tz}
                    </button>
                  );
                })
              }
              {timezones.filter(tz => !tzFilter || tz.toLowerCase().includes(tzFilter.toLowerCase())).length === 0 && (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No timezones match "{tzFilter}"</div>
              )}
            </div>
          </div>
        )}

        {/* Status note */}
        {timezone && !tzOpen && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <IconCheck size={12} style={{ color: 'var(--good)', flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: 'var(--good)', fontFamily: 'var(--font-mono)' }}>{timezone}</span>
            {tzSource && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                · {tzSource === 'auto' ? 'Auto-detected from your browser' : 'Saved preference'}
                {setPage && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px', marginLeft: 4 }} onClick={() => setPage('settings')}>
                    Change in Settings
                  </button>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 24, justifyContent: "flex-end", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button
            className="btn btn-dark btn-lg"
            disabled={!canContinue}
            style={{ opacity: canContinue ? 1 : 0.4, cursor: canContinue ? "pointer" : "not-allowed" }}
            onClick={handleContinue}
          >
            {uploading ? 'Uploading…' : 'Continue to matching'} {!uploading && <IconArrow size={16}/>}
          </button>
          {uploadError && (
            <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, width: 'fit-content' }}>
              <IconWarn size={14}/>
              <span style={{ fontSize: 13 }}>{uploadError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ScreenUpload = ScreenUpload;
