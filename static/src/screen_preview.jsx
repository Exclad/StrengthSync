// Screen 4 — Preview merge with HR chart + set timeline
function ScreenPreview({ onNext, onBack, state }) {
  const [tab, setTab] = useState("merged");

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="h-eyebrow">STEP 04 / PREVIEW</p>
          <h1 className="h-display" style={{ fontSize: 44 }}>Everything <em>checks out.</em></h1>
          <p className="h-sub">All Garmin biometrics preserved. Hevy exercise data layered on top. Review below — nothing is written until you export.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="nav-pill">
            <button className={tab === "before" ? "" : ""} onClick={() => setTab("before")} style={tab === "before" ? { background: "var(--ink)", color: "var(--bg)" } : {}}>Before</button>
            <button onClick={() => setTab("merged")} style={tab === "merged" ? { background: "var(--ink)", color: "var(--bg)" } : {}}>Merged</button>
            <button onClick={() => setTab("diff")} style={tab === "diff" ? { background: "var(--ink)", color: "var(--bg)" } : {}}>Diff</button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <KPI label="Duration"     value="1h 12m"   sub="unchanged"  preserved/>
        <KPI label="Avg HR"       value="128"      unit="bpm"       sub="from Garmin"  preserved/>
        <KPI label="Max HR"       value="168"      unit="bpm"       sub="from Garmin"  preserved/>
        <KPI label="Calories"     value="487"      unit="kcal"      sub="from Garmin"  preserved/>
        <KPI label="Exercises"    value="6"        sub="from Hevy"  replaced/>
        <KPI label="Total volume" value="12,480"   unit="lb"        sub="from Hevy"  replaced/>
      </div>

      {/* HR chart + timeline */}
      <div className="card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>HEART RATE · APR 18 · 06:42–07:54</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>Push Day A <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· Biometric overlay on Hevy sets</span></div>
          </div>
          <div className="row" style={{ gap: 14, fontSize: 11 }}>
            <LegendDot color="var(--accent-2)" label="Heart rate"/>
            <LegendDot color="var(--ink)" label="Set windows"/>
            <LegendDot color="var(--ink-3)" label="Rest"/>
          </div>
        </div>
        <HRChart/>
      </div>

      {/* Exercise breakdown */}
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>EXERCISE SEQUENCE</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>6 exercises · 20 sets</div>
            </div>
            <span className="chip accent"><IconDumbbell size={10}/> FROM HEVY</span>
          </div>
          <div>
            {SET_TIMELINE.map((ex, i) => {
              const e = HEVY_EXERCISES[i];
              return (
                <div key={ex.exerciseId} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 14, padding: "14px 22px", borderBottom: i === SET_TIMELINE.length - 1 ? "none" : "1px solid var(--line)", alignItems: "center" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{String(i+1).padStart(2,"0")}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                    <div className="row" style={{ gap: 4, marginTop: 6 }}>
                      {e.sets.map((s, j) => (
                        <div key={j} style={{ padding: "3px 7px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, fontSize: 11, fontFamily: "JetBrains Mono" }}>
                          {s.weight}<span style={{ color: "var(--ink-3)" }}>×{s.reps}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>
                    {ex.windows.length} sets
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side: data preservation audit */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>DATA AUDIT</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2, marginBottom: 14 }}>What was preserved</div>
            {[
              ["Heart rate samples", "720 / 720", true],
              ["Rest periods", "19 detected", true],
              ["Calorie data", "487 kcal", true],
              ["Device info", "Forerunner 965", true],
              ["GPS track", "not present", null],
              ["Session metadata", "intact", true],
            ].map(([label, value, ok]) => (
              <div key={label} className="row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                {ok === true ? <IconCheck size={14} style={{ color: "var(--good)" }}/> : <IconInfo size={14} style={{ color: "var(--ink-4)" }}/>}
                <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="card card-pad">
            <div className="mono uc" style={{ fontSize: 11, color: "var(--ink-3)" }}>WHAT CHANGED</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2, marginBottom: 14 }}>Replaced by Hevy</div>
            {[
              ["Exercise names", "22 → 6"],
              ["Set count", "corrected"],
              ["Rep counts", "added"],
              ["Weight per set", "added"],
            ].map(([label, value]) => (
              <div key={label} className="row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <IconRefresh size={14} style={{ color: "var(--accent-2)" }}/>
                <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 28, justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onBack}><IconBack size={14}/> Back to mapping</button>
        <div className="row" style={{ gap: 10 }}>
          <span className="chip good mono"><IconCheck size={10}/> VALID FIT · GARMIN CONNECT READY</span>
          <button className="btn btn-primary btn-lg" onClick={onNext}>
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

function HRChart() {
  const W = 1140, H = 260, PAD_L = 52, PAD_R = 16, PAD_T = 24, PAD_B = 40;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xMax = 72;
  const yMin = 60, yMax = 180;

  const x = (t) => PAD_L + (t / xMax) * plotW;
  const y = (hr) => PAD_T + (1 - (hr - yMin) / (yMax - yMin)) * plotH;

  const path = HR_SAMPLES.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s.hr).toFixed(1)}`).join(" ");
  const area = path + ` L ${x(xMax)} ${PAD_T + plotH} L ${PAD_L} ${PAD_T + plotH} Z`;

  // Y gridlines
  const yTicks = [80, 100, 120, 140, 160, 180];
  const xTicks = [0, 15, 30, 45, 60, 72];

  return (
    <div style={{ padding: "12px 22px 22px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Set windows as background bands */}
        {SET_TIMELINE.map((ex, ei) =>
          ex.windows.map(([a, b], wi) => (
            <rect key={`${ei}-${wi}`} x={x(a)} y={PAD_T} width={x(b) - x(a)} height={plotH}
              fill="var(--ink)" opacity="0.06"/>
          ))
        )}

        {/* y grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4"/>
            <text x={PAD_L - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="JetBrains Mono">{t}</text>
          </g>
        ))}

        {/* x grid */}
        {xTicks.map(t => (
          <text key={t} x={x(t)} y={H - PAD_B + 16} textAnchor="middle" fontSize="10" fill="var(--ink-3)" fontFamily="JetBrains Mono">{t}m</text>
        ))}

        {/* HR area + line */}
        <path d={area} fill="url(#hrGrad)"/>
        <path d={path} fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeLinejoin="round"/>

        {/* Timeline below */}
        {SET_TIMELINE.map((ex, ei) => {
          const trackY = H - PAD_B + 22;
          return (
            <g key={`t-${ei}`}>
              {ex.windows.map(([a, b], wi) => (
                <rect key={`tw-${ei}-${wi}`} x={x(a)} y={trackY} width={Math.max(2, x(b) - x(a))} height={6}
                  fill={ex.color} rx={1.5}/>
              ))}
            </g>
          );
        })}

        {/* Y axis label */}
        <text x={16} y={PAD_T + 12} fontSize="10" fill="var(--ink-3)" fontFamily="JetBrains Mono">BPM</text>

        {/* Max HR callout */}
        <g>
          <line x1={PAD_L} y1={y(168)} x2={W - PAD_R} y2={y(168)} stroke="var(--bad)" strokeDasharray="4 4" opacity="0.5"/>
          <rect x={W - PAD_R - 78} y={y(168) - 10} width="74" height="18" rx="4" fill="var(--bad)"/>
          <text x={W - PAD_R - 41} y={y(168) + 3} textAnchor="middle" fontSize="10" fill="#fff" fontFamily="JetBrains Mono" fontWeight="600">MAX · 168</text>
        </g>
      </svg>
    </div>
  );
}

window.ScreenPreview = ScreenPreview;
