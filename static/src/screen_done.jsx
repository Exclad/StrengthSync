// Screen 5 — Done / download
function ScreenDone({ onRestart, state }) {
  const [phase, setPhase] = useState("generating"); // generating | ready

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 20 }}>
      {phase === "generating" ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 32px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line-2)" strokeWidth="4"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent-2)" strokeWidth="4"
                strokeDasharray="40 326" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="1.2s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
          <p className="h-eyebrow" style={{ textAlign: "center" }}>GENERATING FIT FILE</p>
          <h1 className="h-display" style={{ fontSize: 40 }}>Writing your merged workout…</h1>
          <div style={{ marginTop: 24, maxWidth: 420, margin: "24px auto 0", textAlign: "left" }}>
            {[
              "Parsing Garmin biometric stream",
              "Applying exercise mappings",
              "Replacing set/rep records",
              "Validating against FIT schema",
            ].map((s, i) => (
              <div key={s} className="row mono" style={{ padding: "6px 0", fontSize: 12, color: "var(--ink-3)", opacity: 1 - i * 0.08 }}>
                <IconCheck size={12} style={{ color: "var(--good)" }}/>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: "center", padding: "40px 0 8px" }}>
            <div style={{ width: 68, height: 68, margin: "0 auto 20px", borderRadius: 20, background: "var(--accent)", display: "grid", placeItems: "center" }}>
              <IconCheck size={32} style={{ color: "var(--accent-ink)", strokeWidth: 2.5 }}/>
            </div>
            <p className="h-eyebrow">EXPORT COMPLETE</p>
            <h1 className="h-display" style={{ fontSize: 48 }}>Your <em>merged</em> FIT file is ready.</h1>
            <p className="h-sub" style={{ margin: "0 auto" }}>Upload it to Garmin Connect — your workout now has accurate exercises, correct set counts, and every biometric signal your watch captured.</p>
          </div>

          {/* File card */}
          <div className="card" style={{ marginTop: 36, padding: 24 }}>
            <div className="row" style={{ gap: 16 }}>
              <div style={{ width: 56, height: 56, background: "var(--ink)", borderRadius: 14, display: "grid", placeItems: "center", color: "var(--accent)" }}>
                <IconFile size={24}/>
              </div>
              <div className="grow">
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>2026-04-18-STRENGTH-merged.fit</div>
                <div className="row" style={{ gap: 10, fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                  <span>186.4 KB</span>
                  <span>·</span>
                  <span>FIT Protocol v2.0</span>
                  <span>·</span>
                  <span>checksum <span className="mono">a7f3c9d2</span></span>
                </div>
              </div>
              <button className="btn btn-primary btn-xl">
                <IconDownload size={18}/> Download
              </button>
            </div>
            <div style={{ marginTop: 18, padding: 14, background: "var(--surface-2)", borderRadius: 10, borderLeft: "3px solid var(--good)" }}>
              <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <IconCheck size={14} style={{ color: "var(--good)", marginTop: 2 }}/>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink)" }}>Validated against the FIT schema.</strong> This file passes Garmin Connect's upload parser — you'll see it appear in your activity list within ~30 seconds of upload.
                </div>
              </div>
            </div>
          </div>

          {/* Next steps */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <StepCard n="01" title="Open Garmin Connect" sub="connect.garmin.com → Activities"/>
            <StepCard n="02" title="Import activity" sub="Top-right · ⋯ · Import" highlight/>
          </div>

          <div className="row" style={{ marginTop: 36, justifyContent: "space-between" }}>
            <button className="btn btn-ghost" onClick={onRestart}>
              <IconRefresh size={14}/> Sync another workout
            </button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm">Save mapping set</button>
              <button className="btn btn-ghost btn-sm">View run log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepCard({ n, title, sub, highlight }) {
  return (
    <div className="card card-pad" style={{ background: highlight ? "var(--surface-2)" : "var(--surface)" }}>
      <div className="row" style={{ gap: 12 }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>{n}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

window.ScreenDone = ScreenDone;
