// Capitalize first letter of each word, replace underscores with spaces
const toDisplayName = name => name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
// Search normalization: compare spaces-and-words regardless of underscores in source
const matchesSearch = (name, query) => !query || name.replace(/_/g, ' ').toLowerCase().includes(query.trim().toLowerCase());

// Screen 3 — Exercise mapping (HERO)
function ScreenMap({ onNext, onBack, state, update }) {
  const [exercises, setExercises] = useState(() => {
    const mr = state.matchResult;
    const ur = state.uploadResult;
    if (!mr || !ur) return [];
    const wi = mr.hevy_workout_index != null ? mr.hevy_workout_index : 0;
    const hw = ur.hevyWorkouts[wi];
    if (!hw) return [];
    const cardioSet = new Set(hw.skipped_cardio || []);
    return hw.exercises.map((ex, i) => ({
      id: `ex-${i}`,
      hevy: ex.title,
      garmin: null,
      garminLabel: null,
      confidence: 0,
      status: cardioSet.has(ex.title) ? 'cardio' : 'unmapped',
      suggestions: [],
      sets: ex.sets || [],
    }));
  });

  const [selectedId, setSelectedId] = useState(() => {
    const mr = state.matchResult;
    const ur = state.uploadResult;
    if (!mr || !ur) return null;
    const wi = mr.hevy_workout_index != null ? mr.hevy_workout_index : 0;
    const hw = ur.hevyWorkouts[wi];
    if (!hw) return null;
    const cardioSet = new Set(hw.skipped_cardio || []);
    const first = hw.exercises.find((ex) => !cardioSet.has(ex.title));
    return first ? `ex-${hw.exercises.indexOf(first)}` : `ex-0`;
  });

  const [allGarminExercises, setAllGarminExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [search, setSearch] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [confirming, setConfirming] = useState(false);

  // On mount: fetch garmin exercises, then fetch suggestions sequentially (not in parallel)
  // to avoid overloading the server and to prevent out-of-order response races.
  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(setAllGarminExercises).catch(() => {});

    const initialExercises = exercises;
    const fetchSequential = async () => {
      for (const ex of initialExercises) {
        if (ex.status === 'cardio') continue;
        try {
          const r = await fetch('/api/map/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hevy_exercise_name: ex.hevy }),
          });
          if (!r.ok) continue;
          const body = await r.json();
          const suggestions = body.suggestions || [];
          const top = suggestions[0];
          const isConfirmed = body.confirmed === true;
          const newStatus = isConfirmed ? 'mapped' : (top && top.score >= 70 ? 'mapped' : (top ? 'needs-review' : 'unmapped'));
          const confidence = isConfirmed ? 1.0 : (top ? top.score / 100 : 0);
          setExercises(prev => prev.map(e =>
            e.id === ex.id
              ? { ...e, suggestions, status: newStatus, confidence, garmin: top?.id || null, garminLabel: top?.label || null, dbConfirmed: isConfirmed }
              : e
          ));
        } catch {
          setMapError('Could not load suggestions — check the app is still running.');
          break;
        }
      }
    };
    fetchSequential();
  }, []);

  const handleConfirm = async (exId, suggestion) => {
    setMapError(null);
    setConfirming(true);
    const ex = exercises.find(e => e.id === exId);
    if (!ex) { setConfirming(false); return; }
    try {
      const r = await fetch('/api/map/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hevy_name: ex.hevy, garmin_name: suggestion.id }),
      });
      if (!r.ok) {
        const b = await r.json();
        setMapError(b.error || "Couldn't save that mapping. Check the app is still running and try again.");
      } else {
        setExercises(prev => prev.map(e =>
          e.id === exId
            ? { ...e, status: 'mapped', confidence: 1.0, garmin: suggestion.id, garminLabel: suggestion.label, dbConfirmed: true }
            : e
        ));
        setShowSearch(false);
        setSearchQuery('');
        const unresolvedIds = exercises.filter(e => (e.status === 'needs-review' || e.status === 'unmapped') && e.id !== exId).map(e => e.id);
        if (unresolvedIds.length > 0) setSelectedId(unresolvedIds[0]);
      }
    } catch {
      setMapError("Network error — couldn't reach the app. Refresh and try again if the problem persists.");
    }
    setConfirming(false);
  };

  const handleSkip = (exId) => {
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, status: 'skipped' } : e));
    // Auto-advance to next UNRESOLVED exercise
    const unresolvedIds = exercises.filter(e => (e.status === 'needs-review' || e.status === 'unmapped') && e.id !== exId).map(e => e.id);
    if (unresolvedIds.length > 0) setSelectedId(unresolvedIds[0]);
  };

  const handleClear = (exId) => {
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, garmin: null, garminLabel: null, status: 'unmapped', confidence: 0 } : e));
  };

  const unresolvedCount = exercises.filter(e => e.status === 'needs-review' || e.status === 'unmapped').length;
  const canExport = unresolvedCount === 0;
  const autoMapped = exercises.filter(e => e.status === 'mapped' && e.confidence > 0.9).length;
  const pct = exercises.length > 0 ? Math.round(((exercises.length - unresolvedCount) / exercises.length) * 100) : 100;

  const selected = exercises.find(e => e.id === selectedId);

  const mr = state.matchResult;
  const workoutTitle = mr?.hevy?.title || 'Workout';

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 4 }}>STEP 03 / EXERCISE MAPPING · HEVY → GARMIN</p>
          <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>
            {unresolvedCount === 0 ? <>All mapped. <em>Nice.</em></> : <>{unresolvedCount} exercise{unresolvedCount !== 1 ? 's' : ''} <em>need your eyes.</em></>}
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip accent"><IconSparkle size={11}/> AUTO-MAP</span>
          <span className="chip neutral">THRESHOLD · 70%</span>
        </div>
      </div>

      {/* Error banner */}
      {mapError && (
        <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginTop: 12 }}>
          <IconWarn size={14} /><span style={{ fontSize: 13 }}>{mapError}</span>
        </div>
      )}

      {/* Progress ring row */}
      <div style={{ marginTop: 20, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", alignItems: "center", gap: 20 }}>
        <ProgressRing pct={pct}/>
        <div className="grow">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{exercises.length - unresolvedCount}/{exercises.length} exercises resolved</span>
            {unresolvedCount === 0 && <span className="chip good"><IconCheck size={10}/> READY</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {autoMapped} auto-mapped with high confidence · {exercises.filter(e => e.status === 'mapped' && e.confidence <= 0.9).length} manually confirmed · {unresolvedCount} need review
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowLibrary(s => !s); setLibrarySearch(''); }}>
            <IconHistory size={14}/> {showLibrary ? 'Hide' : 'View'} library ({allGarminExercises.length || 0})
          </button>
        </div>
      </div>

      {/* Mapping library panel */}
      {showLibrary && (
        <div className="card" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}>
            <IconSearch size={13}/>
            <input
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              placeholder={`Search ${allGarminExercises.length} Garmin exercises…`}
              style={{ border: 0, background: 'transparent', outline: 'none', font: 'inherit', color: 'inherit', flex: 1, fontSize: 13 }}
              autoFocus
            />
            {librarySearch && (
              <button onClick={() => setLibrarySearch('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {allGarminExercises
              .filter(ex => matchesSearch(ex.exercise_name, librarySearch) || matchesSearch(ex.exercise_category, librarySearch))
              .map((ex, i) => (
                <div key={i} style={{ padding: '9px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{toDisplayName(ex.exercise_name)}</span>
                  <span className="chip neutral" style={{ fontSize: 10 }}>{toDisplayName(ex.exercise_category)}</span>
                </div>
              ))
            }
            {allGarminExercises.filter(ex => matchesSearch(ex.exercise_name, librarySearch) || matchesSearch(ex.exercise_category, librarySearch)).length === 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No exercises match "{librarySearch}"</div>
            )}
          </div>
        </div>
      )}

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
          {selected && (
            <MappingDetail
              exercise={selected}
              onAccept={(exId, suggestion) => handleConfirm(exId, suggestion)}
              onClear={() => handleClear(selected.id)}
              onSkip={() => handleSkip(selected.id)}
              allGarminExercises={allGarminExercises}
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              confirming={confirming}
            />
          )}

          {/* Set list card */}
          {selected && selected.sets && selected.sets.length > 0 && (
            <div className="card">
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>FROM HEVY · PRESERVED AS-IS</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{selected.sets.length} sets logged</div>
                </div>
                {selected.sets.some(s => s.weight_kg > 0) && (
                  <div className="row" style={{ gap: 16 }}>
                    <Stat label="Top set" value={`${Math.max(...selected.sets.map(s=>s.weight_kg))} kg`}/>
                    <Stat label="Volume" value={`${selected.sets.reduce((a,s)=>a+(s.reps||0)*(s.weight_kg||0),0).toLocaleString()} kg`}/>
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 20px 16px" }}>
                {selected.sets.map((s, i) => (
                  <div key={i} className="row" style={{ padding: "10px 0", borderBottom: i === selected.sets.length - 1 ? "none" : "1px solid var(--line)" }}>
                    <div className="mono" style={{ width: 32, color: "var(--ink-3)", fontSize: 12 }}>#{i + 1}</div>
                    <div style={{ width: 80, fontWeight: 600, fontSize: 15 }}>{s.weight_kg} <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 400 }}>kg</span></div>
                    <div style={{ width: 60, color: "var(--ink-2)", fontSize: 14 }}>× {s.reps}</div>
                    <div className="grow" style={{ height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, ((s.weight_kg || 0) / 150) * 100)}%`, height: "100%", background: i === selected.sets.length - 1 ? "var(--accent-2)" : "var(--ink)", borderRadius: 3 }}/>
                    </div>
                    {s.rpe != null && (
                      <div style={{ marginLeft: 12 }}>
                        <span className="chip neutral mono" style={{ fontSize: 10 }}>RPE {s.rpe}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected && selected.status === 'cardio' && (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <span className="chip neutral" style={{ fontSize: 13 }}>CARDIO — SKIPPED</span>
              <p style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>Cardio exercises are excluded from the merged FIT file and require no action.</p>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ marginTop: 28, justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back</button>
        <div className="row" style={{ gap: 10 }}>
          {!canExport && (
            <span className={`chip ${unresolvedCount > 0 ? 'bad' : 'warn'}`} style={{ marginRight: 8 }}>{unresolvedCount} NEED ACTION</span>
          )}
          <button
            className="btn btn-dark btn-lg"
            disabled={!canExport}
            style={{ opacity: canExport ? 1 : 0.4, cursor: canExport ? 'pointer' : 'not-allowed' }}
            onClick={() => onNext({ exercises })}
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
    e.status === "skipped" ? "var(--good)" :
    e.status === "cardio" ? "var(--ink-3)" :
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
          {e.status === "cardio" ? (
            <span className="chip neutral" style={{ fontSize: 10 }}>CARDIO — SKIPPED</span>
          ) : e.status === "skipped" ? (
            <span style={{ color: "var(--good)" }}>Skipped</span>
          ) : e.garminLabel ? (
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

function MappingDetail({ exercise, onAccept, onClear, onSkip, allGarminExercises, showSearch, setShowSearch, searchQuery, setSearchQuery, confirming }) {
  const isResolved = exercise.status === 'mapped' || exercise.status === 'skipped' || exercise.status === 'cardio';

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>MAPPING</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, letterSpacing: "-0.02em" }}>{exercise.hevy}</div>
        </div>
        {exercise.status === "mapped" && (
          exercise.dbConfirmed
            ? <span className="chip good"><IconCheck size={11}/> SAVED IN LIBRARY</span>
            : <span className="chip good"><IconCheck size={11}/> MAPPED · {Math.round(exercise.confidence * 100)}%</span>
        )}
        {exercise.status === "needs-review" && (
          <span className="chip warn"><IconWarn size={11}/> LOW CONFIDENCE · {Math.round(exercise.confidence * 100)}%</span>
        )}
        {exercise.status === "unmapped" && (
          <span className="chip bad"><IconX size={11}/> NO MATCH</span>
        )}
        {exercise.status === "cardio" && (
          <span className="chip neutral">CARDIO — SKIPPED</span>
        )}
        {exercise.status === "skipped" && (
          <span className="chip good"><IconCheck size={11}/> SKIPPED</span>
        )}
      </div>

      {/* The big visual match */}
      {exercise.status !== 'cardio' && (
        <div style={{ padding: "28px 24px", background: "var(--surface-2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
            {/* Hevy source card */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 18 }}>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--ink)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>H</div>
                <span className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>HEVY</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{exercise.hevy}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>{exercise.sets ? exercise.sets.length : 0} sets</div>
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
      )}

      {/* Cardio info */}
      {exercise.status === 'cardio' && (
        <div style={{ padding: "20px 24px", color: "var(--ink-3)", fontSize: 13 }}>
          This is a cardio exercise from Hevy and is excluded from the strength FIT merge. No action needed.
        </div>
      )}

      {/* Suggestions for non-resolved, non-cardio */}
      {!isResolved && (
        <div style={{ padding: "20px 24px" }}>
          {exercise.status === 'unmapped' && (
            <div style={{
              background: 'color-mix(in oklab, var(--warn) 8%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--warn) 25%, var(--line))',
              borderRadius: 10,
              padding: '16px 20px',
              marginBottom: 16,
            }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <IconWarn size={14} style={{ color: 'var(--warn)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, fontWeight: 600 }}>No automatic match found</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Search for a Garmin exercise name below, or skip to use Garmin's original data.
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <IconSparkle size={14} style={{ color: "var(--accent-2)" }}/>
              <span style={{ fontWeight: 600, fontSize: 13 }}>AI suggestions</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>based on name similarity + your library</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}>
              <IconSearch size={12}/> Search all {allGarminExercises.length} Garmin exercises
            </button>
          </div>

          {/* Inline search */}
          {(showSearch || exercise.status === 'unmapped') && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search exercises…"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }}
              />
              <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                {allGarminExercises
                  .filter(e => matchesSearch(e.exercise_name, searchQuery))
                  .slice(0, 25)
                  .map(e => (
                    <button key={e.exercise_name} className="btn btn-ghost btn-sm" disabled={confirming} style={{ marginTop: 4, display: 'block', width: '100%', textAlign: 'left', opacity: confirming ? 0.5 : 1 }}
                      onClick={() => onAccept(exercise.id, { id: e.exercise_name, label: toDisplayName(e.exercise_name) })}>
                      {toDisplayName(e.exercise_name)}
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {exercise.status === 'needs-review' && (
            <div style={{ fontSize: 12, color: 'var(--warn)', fontStyle: 'italic', marginBottom: 8 }}>
              Low confidence match. Review before continuing.
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {exercise.suggestions?.map((s, i) => (
              <button
                key={s.id}
                disabled={confirming}
                onClick={() => onAccept(exercise.id, s)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: i === 0 ? "var(--surface-2)" : "transparent",
                  border: `1px solid ${i === 0 ? "var(--line-2)" : "var(--line)"}`,
                  borderRadius: 10,
                  cursor: confirming ? "not-allowed" : "pointer",
                  opacity: confirming ? 0.5 : 1,
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
                  <ConfidenceBar score={s.score / 100}/>
                  <span className="chip neutral mono" style={{ minWidth: 44, justifyContent: "center" }}>{Math.round(s.score)}%</span>
                  {i === 0 && <span className="kbd">↵</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button
              className={`btn btn-ghost${exercise.status === 'unmapped' ? '' : ' btn-sm'}`}
              style={{ color: "var(--ink-3)" }}
              onClick={onSkip}
            >
              {exercise.status === 'unmapped' ? "Skip — keep Garmin's original exercise" : "Skip this exercise — keep Garmin's guess"}
            </button>
          </div>
        </div>
      )}

      {exercise.status === 'mapped' && (
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "color-mix(in oklab, var(--good) 8%, transparent)" }}>
          <div className="row" style={{ gap: 8, fontSize: 13 }}>
            <IconCheck size={14} style={{ color: "var(--good)" }}/>
            {exercise.dbConfirmed
              ? <span>Using your saved mapping from library. Change it below if needed.</span>
              : <span>Saved to your mapping library — we'll use this next time automatically.</span>
            }
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClear}>Change</button>
        </div>
      )}

      {exercise.status === 'skipped' && (
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "color-mix(in oklab, var(--warn) 8%, transparent)" }}>
          <div className="row" style={{ gap: 8, fontSize: 13 }}>
            <IconWarn size={14} style={{ color: "var(--warn)" }}/>
            <span>Skipped — Garmin's original exercise data will be used.</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClear}>Undo</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, good }) {
  return (
    <div className="stack">
      <div className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: good ? "var(--good)" : "var(--ink)" }}>{value}</div>
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
