// Screen 2 — Workout matching
function ScreenMatch({ onNext, onBack, state, update }) {
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hevy_workouts, setHevyWorkouts] = useState(state.uploadResult?.hevyWorkouts || []);

  useEffect(() => {
    setLoading(true);
    setMatchError(null);
    fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garmin_workout_id: null, hevy_workout_id: null }),
    })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) { setMatchError(body.error || 'Match failed.'); setLoading(false); return; }
        setMatchResult(body);
        update({ matchResult: body });
        setLoading(false);
      })
      .catch(() => { setMatchError('Network error.'); setLoading(false); });
  }, []);

  const handleManualMatch = (hevy_idx) => {
    setLoading(true);
    setMatchError(null);
    fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garmin_workout_id: null, hevy_workout_id: hevy_idx }),
    })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) { setMatchError(body.error || 'Match failed.'); setLoading(false); return; }
        setMatchResult(body);
        update({ matchResult: body });
        setLoading(false);
      })
      .catch(() => { setMatchError('Network error.'); setLoading(false); });
  };

  const garmin = matchResult?.garmin;
  const hevy = matchResult?.hevy;
  const delta = matchResult?.delta_minutes;
  const matched = !!matchResult && !matchError;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 4 }}>STEP 02 / TIME-BASED MATCHING</p>
          <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>
            {loading ? <>Matching workouts&hellip;</> : matched ? <>We found <em>a match.</em></> : <><em>No match found.</em></>}
          </h1>
        </div>
        <span className="chip neutral"><IconClock size={11}/> TOLERANCE · 30 MIN</span>
      </div>

      {/* Error banner */}
      {matchError && (
        <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginTop: 12 }}>
          <IconWarn size={14} /><span style={{ fontSize: 13 }}>{matchError}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && <p style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 12 }}>Matching workouts&hellip;</p>}

      {/* Two-column matching board */}
      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "stretch" }}>
        <ColumnHeader title="Garmin" sub="From uploaded FIT file" icon={<IconWatch size={14}/>}/>
        <div style={{ width: 24 }}></div>
        <ColumnHeader title="Hevy" sub={`${hevy_workouts.length} workouts from CSV`} icon={<IconDumbbell size={14}/>}/>

        {/* Single Garmin workout row */}
        <GarminCard garmin={garmin} matched={matched}/>
        <Connector confidence={matchResult ? Math.max(0, 1 - (delta || 0) / 30) : 0} matched={matched} delta={delta}/>
        <HevyPicker
          selected={hevy}
          workouts={hevy_workouts}
          onSelect={handleManualMatch}
        />
      </div>

      {/* Summary bar */}
      <div style={{ marginTop: 28, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 24 }}>
          <Stat label="Status" value={matched ? "Matched" : "Unmatched"} good={matched}/>
          {matchResult && <Stat label="Delta" value={`${delta?.toFixed(1)} min`}/>}
          {matchResult && <Stat label="Is forced" value={matchResult.is_forced ? "Yes" : "No"}/>}
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back</button>
          <button
            className="btn btn-dark btn-lg"
            disabled={!matchResult}
            style={{ opacity: matchResult ? 1 : 0.4, cursor: matchResult ? 'pointer' : 'not-allowed' }}
            onClick={() => onNext(matchResult)}
          >
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

function GarminCard({ garmin, matched }) {
  if (!garmin) {
    return (
      <div style={{ padding: "16px 0" }}>
        <div className="card" style={{ padding: 18, opacity: 0.5 }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading Garmin workout&hellip;</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "16px 0" }}>
      <div className="card" style={{ padding: 18, opacity: matched ? 1 : 0.6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }} className="mono uc">{fmtDate(garmin.start_time)}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>Garmin Strength</div>
          </div>
          <span className="chip neutral mono">{fmtTime(garmin.start_time)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <MiniStat icon={<IconClock size={12}/>} label="Duration" value={fmtDuration(garmin.total_elapsed_time)}/>
          <MiniStat icon={<IconHeart size={12}/>} label="Avg HR" value={garmin.avg_heart_rate ? `${garmin.avg_heart_rate}` : "—"}/>
          <MiniStat icon={<IconFlame size={12}/>} label="Kcal" value={garmin.total_calories || "—"}/>
          <MiniStat icon={<IconClock size={12}/>} label="End" value={fmtTime(garmin.end_time)}/>
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

function Connector({ confidence, matched, delta }) {
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

function HevyPicker({ selected, workouts, onSelect }) {
  const [open, setOpen] = useState(false);
  if (selected) {
    return (
      <div style={{ padding: "16px 0" }}>
        <div className="card" style={{ padding: 18, borderColor: "var(--ink)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }} className="mono uc">{fmtDate(selected.start_time)}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{selected.title}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
              Change
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <MiniStat icon={<IconClock size={12}/>} label="Start" value={fmtTime(selected.start_time)}/>
            <MiniStat icon={<IconDumbbell size={12}/>} label="Exercises" value={selected.exercise_count}/>
            <MiniStat icon={<IconClock size={12}/>} label="End" value={fmtTime(selected.end_time)}/>
          </div>
          {open && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>Pick a different Hevy workout:</div>
              {workouts.map((w, i) => (
                <button key={i} onClick={() => { onSelect(i); setOpen(false); }} className="btn btn-ghost btn-sm">
                  {fmtDate(w.start_time)} — {w.title} ({w.exercise_count} exercises)
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "16px 0" }}>
      <div className="card" style={{ padding: 18, borderStyle: "dashed", borderColor: "var(--line-2)" }}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}>No auto-match. Pick manually:</div>
        <div style={{ display: "grid", gap: 6 }}>
          {workouts.map((w, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="btn btn-ghost btn-sm"
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--surface-2)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{w.title}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{fmtDate(w.start_time)} · {fmtTime(w.start_time)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ScreenMatch = ScreenMatch;
