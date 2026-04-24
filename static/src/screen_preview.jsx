// Screen 4 — Preview merge with HR chart + set timeline
function ScreenPreview({ onNext, onBack, state }) {
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hevy_idx = state.matchResult?.hevy_workout_index || 0;
    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hevy_workout_index: hevy_idx }),
    })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) { setPreviewError(body.error || 'Preview failed.'); setLoading(false); return; }
        setPreview(body);
        setLoading(false);
      })
      .catch(() => { setPreviewError('Network error loading preview.'); setLoading(false); });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p className="h-eyebrow" style={{ marginBottom: 4 }}>STEP 04 / PREVIEW</p>
        <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>Everything <em>checks out.</em></h1>
        <p className="h-sub" style={{ marginTop: 6, fontSize: 14 }}>Garmin biometrics preserved · Hevy exercises layered on top · nothing written until export.</p>
      </div>

      {/* Error banner */}
      {previewError && (
        <div className="chip bad" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginTop: 16 }}>
          <IconWarn size={14}/><span style={{ fontSize: 13 }}>{previewError}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !previewError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 14 }}>
          Loading preview…
        </div>
      )}

      {/* KPI strip — source-labelled */}
      {preview && (() => {
        const bs = preview.biometricSummary;
        const kpis = [
          { label: 'Duration',   value: bs.total_elapsed_time ? fmtDuration(bs.total_elapsed_time) : '—', preserved: true,  source: 'GARMIN' },
          { label: 'Calories',   value: bs.total_calories != null ? `${bs.total_calories} kcal` : '—',    preserved: true,  source: 'GARMIN' },
          { label: 'Avg HR',     value: bs.avg_heart_rate != null ? `${bs.avg_heart_rate} bpm` : '—',     preserved: true,  source: 'GARMIN' },
          { label: 'Max HR',     value: bs.max_heart_rate != null ? `${bs.max_heart_rate} bpm` : '—',     preserved: true,  source: 'GARMIN' },
          { label: 'Sets',       value: `${preview.afterSets.length}`,                                     preserved: false, source: 'HEVY'   },
          { label: 'Exercises',  value: `${new Set(preview.afterSets.map(s => s.hevy_exercise_name)).size}`, preserved: false, source: 'HEVY' },
        ];
        return (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {kpis.map(k => (
              <div key={k.label} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.preserved ? 'var(--good)' : 'var(--accent-2)', display: 'inline-block', flexShrink: 0 }}/>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{k.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{k.value}</div>
                <div style={{ marginTop: 5, fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: k.preserved ? 'var(--good)' : 'var(--accent-2)' }}>
                  {k.preserved ? '⬡ FROM GARMIN' : '◆ FROM HEVY'}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* HR chart — empty state */}
      {preview && preview.heartRateSamples.length === 0 && (
        <div className="card" style={{ marginTop: 16, padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
          <IconInfo size={20} style={{ marginBottom: 8 }}/>
          <p style={{ fontSize: 14, margin: 0 }}>No HR data — this workout was recorded without a heart rate sensor.</p>
        </div>
      )}

      {/* HR chart — with axes and legend */}
      {preview && preview.heartRateSamples.length > 0 && (() => {
        const samples = preview.heartRateSamples;
        const hrs = samples.map(s => s.hr);
        const dataMin = Math.min(...hrs), dataMax = Math.max(...hrs);
        const yMin = Math.max(40,  Math.floor((dataMin - 10) / 10) * 10);
        const yMax = Math.min(220, Math.ceil((dataMax  + 10) / 10) * 10);
        const avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);

        // SVG layout
        const VW = 1100, VH = 260;
        const padL = 44, padR = 12, padT = 12, padB = 28;
        const cW = VW - padL - padR, cH = VH - padT - padB;

        const xOf = i => padL + (samples.length > 1 ? i / (samples.length - 1) : 0) * cW;
        const yOf = hr => padT + (1 - (hr - yMin) / (yMax - yMin)) * cH;

        const linePts  = samples.map((s, i) => `${xOf(i)},${yOf(s.hr)}`).join(' ');
        const areaPts  = `${padL},${padT + cH} ${linePts} ${padL + cW},${padT + cH}`;

        // Y axis ticks — 4-5 nice values
        const range = yMax - yMin;
        const step = range <= 40 ? 10 : range <= 80 ? 20 : 40;
        const yTicks = [];
        for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);

        // X axis ticks — start, 25%, 50%, 75%, end
        const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => {
          const idx = Math.min(samples.length - 1, Math.round(f * (samples.length - 1)));
          const t = samples[idx]?.t;
          if (!t) return { x: padL + f * cW, label: '' };
          const d = new Date(t);
          const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          return { x: padL + f * cW, label };
        });

        return (
          <div className="card" style={{ marginTop: 16, padding: '16px 20px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)' }}>HEART RATE</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                  {avgHr} avg · {dataMax} max <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 13 }}>bpm</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: 'var(--accent-2)', borderRadius: 1 }}/>
                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>Heart rate (bpm)</span>
                </div>
                <span className="chip neutral mono" style={{ fontSize: 10 }}><IconHeart size={10}/> FROM GARMIN</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', display: 'block' }}>
              {/* Y gridlines + labels */}
              {yTicks.map(v => {
                const y = yOf(v);
                return (
                  <g key={v}>
                    <line x1={padL} y1={y} x2={VW - padR} y2={y} stroke="var(--line)" strokeWidth="1"/>
                    <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-3)">{v}</text>
                  </g>
                );
              })}
              {/* Area fill */}
              <polygon points={areaPts} fill="var(--accent-2)" opacity="0.08"/>
              {/* HR line */}
              <polyline points={linePts} fill="none" stroke="var(--accent-2)" strokeWidth="1.5" strokeLinejoin="round"/>
              {/* X axis baseline */}
              <line x1={padL} y1={padT + cH} x2={VW - padR} y2={padT + cH} stroke="var(--line)" strokeWidth="1"/>
              {/* X labels */}
              {xTicks.map(({ x, label }, i) => (
                <text key={i} x={x} y={VH - 4} textAnchor="middle" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-3)">{label}</text>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Data audit — what changed */}
      {preview && (() => {
        const before = preview.beforeSets;
        const after  = preview.afterSets;
        return (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)' }}>DATA AUDIT · WHAT CHANGED</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                  {before.length} Garmin set records <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>→</span> {after.length} Hevy sets
                </div>
              </div>
              <span className="chip good mono" style={{ fontSize: 10 }}><IconCheck size={10}/> BIOMETRICS INTACT</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {/* Before */}
              <div style={{ padding: '12px 20px', borderRight: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)', display: 'inline-block' }}/>
                  <span className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)' }}>BEFORE · {before.length} sets (Garmin)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                  Generic strength records — exercise codes only, no names.
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {before.slice(0, 6).map((s, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--surface-2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="mono" style={{ color: 'var(--ink-3)' }}>Set {i + 1}</span>
                      <span style={{ color: 'var(--ink-2)' }}>
                        {s.reps != null ? `${s.reps} reps` : ''}
                        {s.weight_kg != null ? ` · ${s.weight_kg}kg` : ''}
                        {s.duration_s != null ? ` · ${Math.round(s.duration_s)}s` : ''}
                        {!s.reps && !s.weight_kg && !s.duration_s ? 'no data' : ''}
                      </span>
                    </div>
                  ))}
                  {before.length > 6 && <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 4 }}>+{before.length - 6} more</div>}
                </div>
              </div>
              {/* After */}
              <div style={{ padding: '12px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-2)', display: 'inline-block' }}/>
                  <span className="mono uc" style={{ fontSize: 10, color: 'var(--accent-2)' }}>AFTER · {after.length} sets (Hevy)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                  Named exercises with confirmed Garmin mappings applied.
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {after.slice(0, 6).map((s, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '5px 10px', background: 'color-mix(in oklab, var(--accent-2) 8%, var(--surface))', borderRadius: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.hevy_exercise_name}</span>
                      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                        {s.reps != null ? `${s.reps}r` : ''}
                        {s.weight_kg != null ? ` · ${s.weight_kg}kg` : ''}
                      </span>
                    </div>
                  ))}
                  {after.length > 6 && <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 4 }}>+{after.length - 6} more</div>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Exercise sequence — from afterSets */}
      {preview && (() => {
        const grouped = {};
        preview.afterSets.forEach(s => {
          if (!grouped[s.hevy_exercise_name]) grouped[s.hevy_exercise_name] = [];
          grouped[s.hevy_exercise_name].push(s);
        });
        const entries = Object.entries(grouped);
        if (entries.length === 0) return null;
        return (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="mono uc" style={{ fontSize: 11, color: 'var(--ink-3)' }}>EXERCISE SEQUENCE</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{preview.afterSets.length} sets · {entries.length} exercises</div>
              </div>
              <span className="chip accent"><IconDumbbell size={10}/> FROM HEVY</span>
            </div>
            <div>
              {entries.map(([name, sets], i) => (
                <div key={name} style={{ padding: '14px 22px', borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    {sets.map((s, j) => `Set ${j+1}: ${s.reps ?? '—'} reps × ${s.weight_kg != null ? `${s.weight_kg}kg` : 'BW'}`).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ marginTop: 28, justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back to mapping</button>
        <div className="row" style={{ gap: 10 }}>
          <span className="chip good mono"><IconCheck size={10}/> VALID FIT · GARMIN CONNECT READY</span>
          <button
            className="btn btn-primary btn-lg"
            disabled={!preview}
            style={{ opacity: preview ? 1 : 0.4 }}
            onClick={() => onNext({ preview, hevy_workout_index: state.matchResult?.hevy_workout_index || 0 })}
          >
            <IconDownload size={16}/> Generate & export .fit
          </button>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, unit, sub, preserved, replaced }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, position: "relative" }}>
      <div className="mono uc" style={{ fontSize: 10, color: "var(--ink-3)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{unit}</span>}
      </div>
      <div className="row" style={{ gap: 4, marginTop: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: preserved ? "var(--good)" : "var(--accent-2)" }}/>
        <span style={{ fontSize: 10, color: "var(--ink-3)" }} className="mono uc">{sub}</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }}/>
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
    </div>
  );
}

window.ScreenPreview = ScreenPreview;
