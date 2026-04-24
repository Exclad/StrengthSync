// Screen 1 — Upload & connect
function ScreenUpload({ onNext, state, update }) {
  const fitInput = useRef(null);
  const hevyInput = useRef(null);

  const [timezones, setTimezones] = useState([]);
  const [timezone, setTimezone] = useState('');
  const [tzFilter, setTzFilter] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch timezone list on mount
  useEffect(() => {
    fetch('/api/timezones')
      .then(r => r.json())
      .then(data => setTimezones(data))
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

  // Demo seed files — no real File objects; upload will show error if attempted
  const seed = () => {
    update({ fitFiles: [
      { id: "s1", name: "2026-04-18-064200-STRENGTH.fit", size: 184320, date: "Apr 18, 2026", _file: null },
      { id: "s2", name: "2026-04-16-181200-STRENGTH.fit", size: 172096, date: "Apr 16, 2026", _file: null },
      { id: "s3", name: "2026-04-15-071000-CARDIO.fit",   size: 92160,  date: "Apr 15, 2026", _file: null },
    ]});
  };

  const canContinue = state.fitFiles.length > 0 && state.hevyFile && timezone && !uploading;

  const handleContinue = async () => {
    setUploadError(null);

    // Guard against demo seed data (no real File objects)
    if (!state.fitFiles[0]._file) {
      setUploadError('Demo data cannot be uploaded — select real files.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('fit_file', state.fitFiles[0]._file);
    if (state.hevyFile) formData.append('hevy_csv', state.hevyFile);
    formData.append('timezone', timezone);

    try {
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await resp.json();
      if (!resp.ok) {
        setUploadError(body.error || 'Upload failed.');
        setUploading(false);
        return;
      }
      update({ timezone, uploadResult: body });
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
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); seed(); }}>
                <IconZap size={14}/> Use demo data
              </button>
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

      {/* Timezone selector */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TIMEZONE</div>
        <input
          type="text"
          placeholder="Filter timezones…"
          value={tzFilter}
          onChange={e => setTzFilter(e.target.value)}
          style={{ width: '100%', marginBottom: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
        />
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          size={5}
          style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, padding: 4 }}
        >
          {timezones.filter(tz => !tzFilter || tz.toLowerCase().includes(tzFilter.toLowerCase())).map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        {timezone && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={12} style={{ color: 'var(--good)' }}/>
            <span style={{ fontSize: 12, color: 'var(--good)', fontFamily: 'var(--font-mono)' }}>{timezone}</span>
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
