// Screen 2 — Workout matching
function ScreenMatch({ onNext, onBack, state, update }) {
  const matches = state.matches || GARMIN_WORKOUTS.map(g => ({
    garminId: g.id,
    hevyId: g.hevyMatchId,
    confidence: g.confidence,
    locked: false,
  }));

  const setMatch = (garminId, hevyId) => {
    const next = matches.map(m => m.garminId === garminId ? { ...m, hevyId, confidence: hevyId ? 1 : 0 } : m);
    update({ matches: next });
  };

  const findHevy = (id) => HEVY_WORKOUTS.find(h => h.id === id);
  const findGarmin = (id) => GARMIN_WORKOUTS.find(g => g.id === id);

  const matchedCount = matches.filter(m => m.hevyId).length;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="h-eyebrow">STEP 02 / TIME-BASED MATCHING</p>
          <h1 className="h-display" style={{ fontSize: 44 }}>We found <em>{matchedCount} matches.</em></h1>
          <p className="h-sub">Auto-matched by start-time proximity (±60 minute window). Drag or click to remap if anything looks off.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip neutral"><IconClock size={11}/> TOLERANCE · 60 MIN</span>
          <button className="btn btn-ghost btn-sm"><IconRefresh size={14}/> Re-run</button>
        </div>
      </div>

      {/* Two-column matching board */}
      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "stretch" }}>
        <ColumnHeader title="Garmin" sub="From FIT files" icon={<IconWatch size={14}/>}/>
        <div style={{ width: 24 }}></div>
        <ColumnHeader title="Hevy" sub={`${HEVY_WORKOUTS.length} workouts · last 7 days`} icon={<IconDumbbell size={14}/>}/>

        {GARMIN_WORKOUTS.map(g => {
          const match = matches.find(m => m.garminId === g.id);
          const h = match?.hevyId ? findHevy(match.hevyId) : null;
          return (
            <React.Fragment key={g.id}>
              <GarminCard g={g} matched={!!h}/>
              <Connector confidence={match?.confidence || 0} matched={!!h} />
              <HevyPicker
                selected={h}
                workouts={HEVY_WORKOUTS}
                garminStart={g.start}
                onSelect={(hid) => setMatch(g.id, hid)}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{ marginTop: 28, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 24 }}>
          <Stat label="Matched" value={matchedCount} good/>
          <Stat label="Skipped" value={GARMIN_WORKOUTS.length - matchedCount}/>
          <Stat label="Avg confidence" value="97%"/>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back</button>
          <button className="btn btn-dark btn-lg" onClick={onNext}>
            Map exercises <IconArrow size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({ title, sub, icon }) {
  return (
    <div style={{ padding: "0 4px 14px", borderBottom: "1px solid var(--line)" }}>
      <div className="row" style={{ gap: 8 }}>
        {icon}
        <span className="uc mono" style={{ fontSize: 11, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Stat({ label, value, good }) {
  return (
    <div className="stack">
      <div className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: good ? "var(--good)" : "var(--ink)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function GarminCard({ g, matched }) {
  return (
    <div style={{ padding: "16px 0" }}>
      <div className="card" style={{ padding: 18, opacity: matched ? 1 : 0.6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }} className="mono uc">{fmtDate(g.start)}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{g.name}</div>
          </div>
          <span className="chip neutral mono">{fmtTime(g.start)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <MiniStat icon={<IconClock size={12}/>} label="Duration" value={fmtDuration(g.durationSec)}/>
          <MiniStat icon={<IconHeart size={12}/>} label="Avg HR" value={`${g.avgHr}`}/>
          <MiniStat icon={<IconFlame size={12}/>} label="Kcal" value={g.calories}/>
          <MiniStat icon={<IconDumbbell size={12}/>} label="Sets" value={g.sets || "—"} warn={g.sets === 0}/>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, warn }) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: 4, color: "var(--ink-3)", fontSize: 10 }} className="mono uc">
        {icon}
        <span className="mono uc" style={{ fontSize: 10 }}>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: warn ? "var(--warn)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Connector({ confidence, matched }) {
  const pct = Math.round(confidence * 100);
  return (
    <div style={{ padding: "16px 0", display: "grid", placeItems: "center", minWidth: 80 }}>
      <div style={{ width: "100%", display: "grid", placeItems: "center", gap: 4 }}>
        {matched ? (
          <>
            <svg width="72" height="40" viewBox="0 0 72 40" fill="none">
              <path d="M0 20 L72 20" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3"/>
              <circle cx="36" cy="20" r="14" fill="var(--accent)"/>
              <path d="M30 20l4 4 8-8" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{pct}% MATCH</div>
          </>
        ) : (
          <>
            <svg width="72" height="40" viewBox="0 0 72 40" fill="none">
              <path d="M0 20 L72 20" stroke="var(--line-2)" strokeWidth="2" strokeDasharray="4 3"/>
              <circle cx="36" cy="20" r="14" fill="var(--surface)" stroke="var(--warn)" strokeWidth="1.5"/>
              <path d="M36 14v6M36 24v.01" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="mono" style={{ fontSize: 10, color: "var(--warn)" }}>NO MATCH</div>
          </>
        )}
      </div>
    </div>
  );
}

function HevyPicker({ selected, workouts, garminStart, onSelect }) {
  const [open, setOpen] = useState(false);
  if (selected) {
    return (
      <div style={{ padding: "16px 0" }}>
        <div className="card" style={{ padding: 18, borderColor: "var(--ink)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }} className="mono uc">{fmtDate(selected.start)}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{selected.name}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onSelect(null)}>
              Change
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <MiniStat icon={<IconClock size={12}/>} label="Start" value={fmtTime(selected.start)}/>
            <MiniStat icon={<IconDumbbell size={12}/>} label="Exercises" value={selected.exerciseCount}/>
            <MiniStat icon={<IconZap size={12}/>} label="Volume" value={`${(selected.totalVolume/1000).toFixed(1)}k`}/>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "16px 0" }}>
      <div className="card" style={{ padding: 18, borderStyle: "dashed", borderColor: "var(--line-2)" }}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}>No auto-match. Pick manually:</div>
        <div style={{ display: "grid", gap: 6 }}>
          {workouts.map(w => (
            <button
              key={w.id}
              onClick={() => onSelect(w.id)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--surface-2)",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{fmtDate(w.start)} · {fmtTime(w.start)}</span>
              </div>
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ justifyContent: "center", marginTop: 4 }}>
            Skip this workout
          </button>
        </div>
      </div>
    </div>
  );
}

window.ScreenMatch = ScreenMatch;
