// Screen 3 — Exercise mapping (HERO)
function ScreenMap({ onNext, onBack, state, update }) {
  const exercises = state.exercises || HEVY_EXERCISES;
  const [selectedId, setSelectedId] = useState(exercises.find(e => e.status !== "mapped")?.id || exercises[0].id);
  const [search, setSearch] = useState("");

  const setExercises = (next) => update({ exercises: next });
  const selected = exercises.find(e => e.id === selectedId);

  const accept = (exId, garminKey, label) => {
    setExercises(exercises.map(e => e.id === exId ? { ...e, garmin: garminKey, garminLabel: label, status: "mapped", confidence: 1 } : e));
    // auto-advance to next unresolved
    const idx = exercises.findIndex(e => e.id === exId);
    const next = exercises.slice(idx + 1).find(e => e.status !== "mapped") || exercises.find(e => e.status !== "mapped" && e.id !== exId);
    if (next) setSelectedId(next.id);
  };

  const unresolved = exercises.filter(e => e.status !== "mapped").length;
  const autoMapped = exercises.filter(e => e.status === "mapped" && e.confidence > 0.9).length;
  const pct = Math.round(((exercises.length - unresolved) / exercises.length) * 100);

  const canContinue = unresolved === 0;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="h-eyebrow">STEP 03 / EXERCISE MAPPING · HEVY → GARMIN</p>
          <h1 className="h-display" style={{ fontSize: 44 }}>
            {unresolved === 0 ? <>All mapped. <em>Nice.</em></> : <>{unresolved} <em>need your eyes.</em></>}
          </h1>
          <p className="h-sub">We've auto-mapped {autoMapped} of {exercises.length} exercises from <strong style={{ color: "var(--ink)" }}>Push Day A — Chest / Shoulders / Tri</strong>. Confirm or correct the rest — your choices are remembered forever.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="chip accent"><IconSparkle size={11}/> AI AUTO-MAP</span>
          <span className="chip neutral">THRESHOLD · 90%</span>
        </div>
      </div>

      {/* Progress ring row */}
      <div style={{ marginTop: 20, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", alignItems: "center", gap: 20 }}>
        <ProgressRing pct={pct}/>
        <div className="grow">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{exercises.length - unresolved}/{exercises.length} exercises resolved</span>
            {unresolved === 0 && <span className="chip good"><IconCheck size={10}/> READY</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {autoMapped} auto-mapped with high confidence · {exercises.length - autoMapped - unresolved} manually confirmed · {unresolved} need review
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm"><IconHistory size={14}/> View mapping library ({247})</button>
        </div>
      </div>

      {/* Main mapping board */}
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>

        {/* LEFT: list */}
        <div className="card" style={{ padding: 0, overflow: "hidden", alignSelf: "start", position: "sticky", top: 140 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ gap: 8, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-2)" }}>
              <IconSearch size={14}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter exercises..."
                style={{ border: 0, background: "transparent", outline: "none", font: "inherit", color: "inherit", flex: 1, fontSize: 13 }}
              />
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{exercises.length}</span>
            </div>
          </div>
          <div style={{ maxHeight: 540, overflow: "auto" }}>
            {exercises
              .filter(e => !search || e.hevy.toLowerCase().includes(search.toLowerCase()))
              .map((e, i) => (
              <ExerciseListItem
                key={e.id}
                e={e}
                num={i + 1}
                selected={selectedId === e.id}
                onClick={() => setSelectedId(e.id)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: detail pane */}
        <div style={{ display: "grid", gap: 16 }}>
          {selected && <MappingDetail exercise={selected} onAccept={accept} onClear={() => setExercises(exercises.map(x => x.id === selected.id ? { ...x, garmin: null, garminLabel: null, status: "unmapped", confidence: 0 } : x))}/>}

          {/* Set list card */}
          {selected && (
            <div className="card">
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>FROM HEVY · PRESERVED AS-IS</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{selected.sets.length} sets logged</div>
                </div>
                <div className="row" style={{ gap: 16 }}>
                  <Stat label="Top set" value={`${Math.max(...selected.sets.map(s=>s.weight))} lb`}/>
                  <Stat label="Volume" value={`${selected.sets.reduce((a,s)=>a+s.reps*s.weight,0).toLocaleString()} lb`}/>
                </div>
              </div>
              <div style={{ padding: "12px 20px 16px" }}>
                {selected.sets.map((s, i) => (
                  <div key={i} className="row" style={{ padding: "10px 0", borderBottom: i === selected.sets.length - 1 ? "none" : "1px solid var(--line)" }}>
                    <div className="mono" style={{ width: 32, color: "var(--ink-3)", fontSize: 12 }}>#{i + 1}</div>
                    <div style={{ width: 80, fontWeight: 600, fontSize: 15 }}>{s.weight} <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 400 }}>lb</span></div>
                    <div style={{ width: 60, color: "var(--ink-2)", fontSize: 14 }}>× {s.reps}</div>
                    <div className="grow" style={{ height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${(s.weight / 220) * 100}%`, height: "100%", background: i === selected.sets.length - 1 ? "var(--accent-2)" : "var(--ink)", borderRadius: 3 }}/>
                    </div>
                    <div style={{ marginLeft: 12 }}>
                      <span className="chip neutral mono" style={{ fontSize: 10 }}>RPE {s.rpe}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ marginTop: 28, justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back</button>
        <div className="row" style={{ gap: 10 }}>
          {unresolved > 0 && <span className="chip warn"><IconWarn size={10}/> {unresolved} UNRESOLVED</span>}
          <button
            className="btn btn-dark btn-lg"
            onClick={onNext}
            disabled={!canContinue}
            style={{ opacity: canContinue ? 1 : 0.4, cursor: canContinue ? "pointer" : "not-allowed" }}
          >
            Preview merge <IconArrow size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ pct }) {
  const C = 2 * Math.PI * 22;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--line-2)" strokeWidth="4"/>
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--accent-2)" strokeWidth="4"
        strokeDasharray={C} strokeDashoffset={C - (C * pct / 100)}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"/>
      <text x="28" y="32" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink)">{pct}</text>
    </svg>
  );
}

function ExerciseListItem({ e, num, selected, onClick }) {
  const color =
    e.status === "mapped" ? "var(--good)" :
    e.status === "needs-review" ? "var(--warn)" :
    "var(--bad)";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        border: 0,
        borderLeft: `3px solid ${selected ? "var(--accent-2)" : "transparent"}`,
        borderBottom: "1px solid var(--line)",
        background: selected ? "var(--surface-2)" : "transparent",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div className="mono" style={{ width: 22, fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>{String(num).padStart(2, "0")}</div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {e.hevy}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", overflow: "hidden" }}>
          {e.garminLabel ? (
            <>
              <IconArrow size={10}/>
              <span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>{e.garminLabel}</span>
            </>
          ) : (
            <span style={{ color: "var(--warn)" }}>No Garmin mapping</span>
          )}
        </div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: color }}/>
    </button>
  );
}

function MappingDetail({ exercise, onAccept, onClear }) {
  const isReview = exercise.status !== "mapped";
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>MAPPING</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, letterSpacing: "-0.02em" }}>{exercise.hevy}</div>
        </div>
        {exercise.status === "mapped" && (
          <span className="chip good"><IconCheck size={11}/> MAPPED · {Math.round(exercise.confidence * 100)}%</span>
        )}
        {exercise.status === "needs-review" && (
          <span className="chip warn"><IconWarn size={11}/> LOW CONFIDENCE · {Math.round(exercise.confidence * 100)}%</span>
        )}
        {exercise.status === "unmapped" && (
          <span className="chip bad"><IconX size={11}/> NO MATCH</span>
        )}
      </div>

      {/* The big visual match */}
      <div style={{ padding: "28px 24px", background: "var(--surface-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
          {/* Hevy source card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 18 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ink)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>H</div>
              <span className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>HEVY</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{exercise.hevy}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>{exercise.sets.length} sets · {exercise.sets.reduce((a,s)=>a+s.reps,0)} reps</div>
          </div>

          {/* Arrow */}
          <div style={{ display: "grid", placeItems: "center" }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill={exercise.status === "mapped" ? "var(--accent)" : "var(--surface)"} stroke={exercise.status === "mapped" ? "var(--accent)" : "var(--line-2)"} strokeWidth="1.5"/>
              <path d="M16 24h16M26 18l6 6-6 6" stroke={exercise.status === "mapped" ? "var(--accent-ink)" : "var(--ink-3)"} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Garmin target */}
          {exercise.garminLabel ? (
            <div style={{ background: "var(--surface)", border: `1px solid ${exercise.status === "mapped" ? "var(--ink)" : "var(--line)"}`, borderRadius: 12, padding: 18 }}>
              <div className="row" style={{ gap: 8, marginBottom: 10, justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ink)", color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>G</div>
                  <span className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>GARMIN</span>
                </div>
                <button className="icon-btn" style={{ width: 26, height: 26 }} title="Clear mapping" onClick={onClear}>
                  <IconX size={12}/>
                </button>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{exercise.garminLabel}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>id · {exercise.garmin}</div>
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "2px dashed var(--line-2)", borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 6 }}>GARMIN</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-3)" }}>Pick from suggestions below</div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {isReview && (
        <div style={{ padding: "20px 24px" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <IconSparkle size={14} style={{ color: "var(--accent-2)" }}/>
              <span style={{ fontWeight: 600, fontSize: 13 }}>AI suggestions</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>based on name similarity + your library</span>
            </div>
            <button className="btn btn-ghost btn-sm">
              <IconSearch size={12}/> Search all 312 Garmin exercises
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {exercise.suggestions?.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onAccept(exercise.id, s.id, s.label)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: i === 0 ? "var(--surface-2)" : "transparent",
                  border: `1px solid ${i === 0 ? "var(--line-2)" : "var(--line)"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  font: "inherit", color: "inherit",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-2)" }}>{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="grow">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>garmin · {s.id}</div>
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <ConfidenceBar score={s.score}/>
                  <span className="chip neutral mono" style={{ minWidth: 44, justifyContent: "center" }}>{Math.round(s.score * 100)}%</span>
                  {i === 0 && <span className="kbd">↵</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
            <button className="btn btn-ghost btn-sm"><IconPlus size={12}/> Create custom mapping</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--ink-3)" }}>Skip this exercise — keep Garmin's guess</button>
          </div>
        </div>
      )}

      {!isReview && (
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "color-mix(in oklab, var(--good) 8%, transparent)" }}>
          <div className="row" style={{ gap: 8, fontSize: 13 }}>
            <IconCheck size={14} style={{ color: "var(--good)" }}/>
            <span>Saved to your mapping library — we'll use this next time automatically.</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClear}>Undo</button>
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ score }) {
  return (
    <div style={{ width: 80, height: 4, background: "var(--line-2)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${score * 100}%`, height: "100%", background: score > 0.8 ? "var(--good)" : score > 0.6 ? "var(--warn)" : "var(--bad)" }}/>
    </div>
  );
}

window.ScreenMap = ScreenMap;
