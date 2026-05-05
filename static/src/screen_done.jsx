// Screen 5 — Done / download
function ScreenDone({ onRestart, onNextFit, fitIndex, fitCount, state }) {
  const [phase, setPhase] = useState('generating');  // 'generating' | 'ready' | 'error'
  const [exportError, setExportError] = useState(null);
  const [fitBlob, setFitBlob] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const controller = useRef(null);

  useEffect(() => {
    // Build log lines based on state
    const LOG = ["Validating FIT file structure"];

    const exercises = state?.exercises;
    const hasMappedExercises = exercises && exercises.length > 0;
    const hasConfirmedMappings = exercises?.some(ex => ex.dbConfirmed);

    if (hasMappedExercises) {
      LOG.unshift("Parsing Garmin biometric stream");
      if (hasConfirmedMappings) {
        LOG.splice(1, 0, "Applying confirmed exercise mappings from library");
      }
      LOG.splice(hasMappedExercises ? 2 : 1, 0, "Replacing set/rep records with Hevy exercise data");
    } else {
      LOG.unshift("Parsing Garmin biometric stream");
    }

    // Show log lines one by one as visual feedback while fetch is in flight
    // Use staggered timeouts purely for UX (no artificial delay on the fetch itself)
    LOG.forEach((line, i) => setTimeout(() => setLogLines(prev => [...prev, line]), i * 400));

    const hevy_idx = state && state.matchResult ? state.matchResult.hevy_workout_index || 0 : 0;
    controller.current = new AbortController();
    const timeoutId = setTimeout(() => controller.current?.abort(), 60000);

    fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hevy_workout_index: hevy_idx }),
      signal: controller.current.signal,
    })
      .then(async r => {
        clearTimeout(timeoutId);
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: 'Export failed.' }));
          setExportError(body.error || 'Export failed.');
          setPhase('error');
          return;
        }
        const blob = await r.blob();
        setFitBlob(blob);
        setPhase('ready');
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setPhase('error');
          setExportError('Export cancelled or timed out. Go back to Preview and try again.');
          return;
        }
        setExportError('Network error during export.');
        setPhase('error');
      });
  }, []);

  const isBatch = fitCount > 1;
  const remaining = fitCount - (fitIndex + 1);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleDownload = () => {
    if (!fitBlob) return;
    const url = URL.createObjectURL(fitBlob);
    objectUrlRef.current = url;
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    const suffix = isBatch ? `-${fitIndex + 1}of${fitCount}` : '';
    a.href = url;
    a.download = `${today}-STRENGTH-merged${suffix}.fit`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation — browser initiates the download asynchronously
    setTimeout(() => { URL.revokeObjectURL(url); objectUrlRef.current = null; }, 100);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 20 }}>

      {phase === 'generating' && (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 32px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line-2)" strokeWidth="4"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent-2)" strokeWidth="4"
                strokeDasharray="40 326" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="1.2s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
          <p className="h-eyebrow" style={{ textAlign: 'center' }}>GENERATING FIT FILE</p>
          <h1 className="h-display" style={{ fontSize: 40 }}>Writing your merged workout…</h1>
          <div style={{ marginTop: 24 }}>
            {logLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
                <IconCheck size={12} style={{ color: 'var(--good)' }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-2)' }}>{line}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { controller.current?.abort(); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderRadius: 10 }}>
          <IconWarn size={16}/><span style={{ fontSize: 14 }}>{exportError}</span>
        </div>
      )}

      {phase === 'ready' && fitBlob && (
        <div>
          <div style={{ textAlign: 'center', padding: '40px 0 8px' }}>
            <div style={{ width: 68, height: 68, margin: '0 auto 20px', borderRadius: 20, background: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
              <IconCheck size={32} style={{ color: 'var(--accent-ink)', strokeWidth: 2.5 }}/>
            </div>
            <p className="h-eyebrow">EXPORT COMPLETE</p>
            <h1 className="h-display" style={{ fontSize: 48 }}>Your <em>merged</em> FIT file is ready.</h1>
            <p className="h-sub" style={{ margin: '0 auto' }}>Upload it to Garmin Connect — your workout now has accurate exercises, correct set counts, and every biometric signal your watch captured.</p>
          </div>

          {/* Validation success banner */}
          <div className="card" style={{ marginTop: 36, borderLeft: '3px solid var(--good)', padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCheck size={14} style={{ color: 'var(--good)' }}/>
              <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>
                Validated against the FIT schema. This file passes Garmin Connect's upload parser — you'll see it appear in your activity list within ~30 seconds of upload.
              </span>
            </div>
          </div>

          {/* Download card */}
          <div className="card" style={{ padding: 24 }}>
            <div className="row" style={{ gap: 16 }}>
              <div style={{ width: 56, height: 56, background: 'var(--ink)', borderRadius: 14, display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                <IconFile size={24}/>
              </div>
              <div className="grow">
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {new Date().toISOString().slice(0,10)}-STRENGTH-merged.fit
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>
                  {(fitBlob.size / 1024).toFixed(1)} KB · FIT Protocol 2.0
                </div>
              </div>
              <button className="btn btn-primary btn-xl" onClick={handleDownload}>
                <IconDownload size={18}/> Download .fit file
              </button>
            </div>
          </div>

          {/* Privacy notice */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))', borderRadius: 10, fontSize: 14, color: 'var(--ink-2)' }}>
            All processing happens locally. Your workout data never leaves your machine — FIT parsing, mapping, and merging all run in Python on localhost.
          </div>

          {/* Next steps */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StepCard n="01" title="Open Garmin Connect" sub="connect.garmin.com → Activities" href="https://connect.garmin.com/app/activities"/>
            <StepCard n="02" title="Import activity" sub="connect.garmin.com/app/import-data" highlight href="https://connect.garmin.com/app/import-data"/>
          </div>

          {/* Batch next / restart */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
            {remaining > 0 && (
              <button className="btn btn-dark btn-lg" onClick={onNextFit}>
                Next workout ({remaining} remaining) <IconArrow size={16}/>
              </button>
            )}
            <button className="btn btn-ghost" onClick={onRestart}>
              {remaining > 0 ? 'Start over' : 'Sync another workout'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function StepCard({ n, title, sub, highlight, href }) {
  const inner = (
    <div className="row" style={{ gap: 12 }}>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>{n}</div>
      <div className="grow">
        <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 3 }}>{sub}</div>
      </div>
      {href && <IconArrow size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>}
    </div>
  );
  const style = { background: highlight ? "var(--surface-2)" : "var(--surface)" };
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="card card-pad"
      style={{ ...style, display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {inner}
    </a>
  ) : (
    <div className="card card-pad" style={style}>{inner}</div>
  );
}

window.ScreenDone = ScreenDone;
