// Screen: History — list of previously exported merged FIT files
function ScreenHistory({ onBack }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { setFiles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDownload = (filename) => {
    const a = document.createElement('a');
    a.href = `/api/history/download?name=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fmtMtime = (mtime) => {
    const d = new Date(mtime * 1000);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
           ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 4 }}>HISTORY / EXPORTED FILES</p>
          <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>
            {loading ? <>Loading&hellip;</> : <>{files.length} <em>merged {files.length === 1 ? 'file' : 'files'}</em></>}
          </h1>
        </div>
        <span className="chip neutral mono" style={{ fontSize: 10 }}>LOCAL OUTPUT FOLDER</span>
      </div>

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Loading history…</div>
      )}

      {!loading && files.length === 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px', textAlign: 'center', gap: 8 }}>
          <IconHistory size={32} style={{ color: 'var(--ink-4)', marginBottom: 16 }}/>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>No merged files yet</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.5, maxWidth: 420 }}>
            Merged FIT files appear here after you complete a sync. Each file is saved locally in the output/ folder and ready to upload to Garmin Connect.
          </div>
          <button
            className="btn btn-dark btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => onBack()}
          >
            <IconArrow size={13}/> Start a sync
          </button>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, alignItems: 'center' }}>
            <span className="mono uc" style={{ fontSize: 11, color: 'var(--ink-2)' }}>File</span>
            <span className="mono uc" style={{ fontSize: 11, color: 'var(--ink-2)' }}>Size</span>
            <span className="mono uc" style={{ fontSize: 11, color: 'var(--ink-2)' }}>Exported</span>
            <span style={{ width: 90 }}/>
          </div>
          {files.map((f, i) => (
            <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, padding: '14px 16px', borderBottom: i === files.length - 1 ? 'none' : '1px solid var(--line)', alignItems: 'center' }}>
              <div className="row" style={{ gap: 10 }}>
                <IconFile size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
                <div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>FIT Protocol 2.0 · Garmin Connect ready</div>
                </div>
              </div>
              <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{f.size_kb} KB</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtMtime(f.mtime)}</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => handleDownload(f.name)}
              >
                <IconDownload size={13}/> Download
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))', borderRadius: 10, fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconLock size={13}/>
        Files are stored locally in the <span className="mono" style={{ margin: '0 2px' }}>output/</span> folder. They are never uploaded or shared.
      </div>
    </div>
  );
}

window.ScreenHistory = ScreenHistory;
