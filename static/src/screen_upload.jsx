// Screen 1 — Upload & connect
function ScreenUpload({ onNext, state, update }) {
  const fitInput = useRef(null);

  const addFiles = (files) => {
    const newFiles = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name || "Strength_Training_2026-04-18.fit",
      size: f.size || 184320,
      date: "Apr 18, 2026 · 06:42",
    }));
    update({ fitFiles: [...state.fitFiles, ...newFiles] });
  };

  const onDrop = (e) => {
    e.preventDefault();
    update({ dragging: false });
    addFiles(e.dataTransfer.files);
  };

  // Demo seed files
  const seed = () => {
    update({ fitFiles: [
      { id: "s1", name: "2026-04-18-064200-STRENGTH.fit", size: 184320, date: "Apr 18, 2026 · 06:42" },
      { id: "s2", name: "2026-04-16-181200-STRENGTH.fit", size: 172096, date: "Apr 16, 2026 · 18:12" },
      { id: "s3", name: "2026-04-15-071000-CARDIO.fit",   size: 92160,  date: "Apr 15, 2026 · 07:10" },
    ]});
  };

  const canContinue = state.fitFiles.length > 0 && state.hevyMode;

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

          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <HevyOption
              sel={state.hevyMode === "api"}
              onClick={() => update({ hevyMode: "api" })}
              icon={<IconLink size={16}/>}
              title="Connect Hevy account"
              sub="OAuth2 · auto-fetch last 30 days"
              badge="RECOMMENDED"
            />
            <HevyOption
              sel={state.hevyMode === "file"}
              onClick={() => update({ hevyMode: "file" })}
              icon={<IconFile size={16}/>}
              title="Upload export file"
              sub="CSV or JSON from Hevy Settings"
            />
          </div>

          {state.hevyMode === "api" && (
            <div style={{ marginTop: 14, padding: 14, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>Signed in as</div>
              <div className="row">
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>MK</div>
                <div className="stack grow">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>maya.k@hevy</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>token · ••••••74fa · expires in 87d</div>
                </div>
                <span className="chip good"><span className="dot"></span>LIVE</span>
              </div>
            </div>
          )}

          {state.hevyMode === "file" && (
            <div style={{ marginTop: 14, padding: 14, background: "var(--surface-2)", borderRadius: 10, border: "1px dashed var(--line-2)", textAlign: "center" }}>
              <IconUpload size={18}/>
              <div style={{ fontSize: 13, marginTop: 4 }}>Drop hevy-export.json</div>
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

      <div className="row" style={{ marginTop: 32, justifyContent: "space-between" }}>
        <div className="row" style={{ color: "var(--ink-3)", fontSize: 13 }}>
          <IconInfo size={14}/> Your last sync was <strong style={{ color: "var(--ink-2)" }}>2 days ago</strong> — 4 workouts merged successfully.
        </div>
        <button
          className="btn btn-dark btn-lg"
          onClick={onNext}
          disabled={!canContinue}
          style={{ opacity: canContinue ? 1 : 0.4, cursor: canContinue ? "pointer" : "not-allowed" }}
        >
          Continue to matching <IconArrow size={16}/>
        </button>
      </div>
    </div>
  );
}

function HevyOption({ sel, onClick, icon, title, sub, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: sel ? "var(--surface-2)" : "transparent",
        border: `1px solid ${sel ? "var(--ink)" : "var(--line)"}`,
        borderRadius: 12,
        padding: "14px 14px",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "all .12s ease",
      }}
    >
      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${sel ? "var(--ink)" : "var(--line-2)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {sel && <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent-2)" }}/>}
      </div>
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          {badge && <span className="chip accent" style={{ fontSize: 9 }}>{badge}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ color: "var(--ink-3)" }}>{icon}</div>
    </button>
  );
}

window.ScreenUpload = ScreenUpload;
