const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "accent": "lime",
  "accent2": "orange",
  "density": "comfortable",
  "startStep": 0
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  lime:    { light: "#E6FF3D", dark: "#E6FF3D", ink: "#14140F" },
  cyan:    { light: "#4FD6FF", dark: "#4FD6FF", ink: "#14140F" },
  magenta: { light: "#FF4FB8", dark: "#FF4FB8", ink: "#14140F" },
  violet:  { light: "#B99DFF", dark: "#B99DFF", ink: "#14140F" },
};
const ACCENT2_PRESETS = {
  orange: "#FF5A1F",
  red:    "#E63946",
  blue:   "#3D7BFF",
  green:  "#2F9E5D",
};

function applyTweaks(t) {
  const r = document.documentElement;
  const a = ACCENT_PRESETS[t.accent] || ACCENT_PRESETS.lime;
  r.style.setProperty("--accent", a.light);
  r.style.setProperty("--accent-ink", a.ink);
  r.style.setProperty("--accent-2", ACCENT2_PRESETS[t.accent2] || ACCENT2_PRESETS.orange);
}

function App() {
  const [step, setStep] = useState(TWEAK_DEFAULS.startStep || 0);
  const [theme, setTheme] = useState(() => localStorage.getItem("ss-theme") || "light");
  const [tweaksOn, setTweaksOn] = useState(false);
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULS);
  const [page, setPage] = useState("sync");

  const [appState, setAppState] = useState({
    fitFiles: [],
    hevyMode: null,
    hevyFile: null,
    dragging: false,
    timezone: '',
    uploadResult: null,
    matchResult: null,
    exercises: null,
    previewResult: null,
  });
  const update = (patch) => setAppState(s => ({ ...s, ...patch }));

  // Persist theme
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("ss-theme", theme);
  }, [theme]);

  // Persist step (dev deep-link convenience — keep existing step guards)
  useEffect(() => {
    const saved = localStorage.getItem("ss-step");
    if (saved !== null && Number(saved) >= 0 && Number(saved) < 5) {
      setStep(Number(saved));
      // hydrate required state to get past guards when deep-linking
      if (Number(saved) >= 1) {
        setAppState(s => ({
          ...s,
          fitFiles: s.fitFiles.length ? s.fitFiles : [
            { id: "s1", name: "2026-04-18-064200-STRENGTH.fit", size: 184320, date: "Apr 18, 2026 · 06:42" },
            { id: "s2", name: "2026-04-16-181200-STRENGTH.fit", size: 172096, date: "Apr 16, 2026 · 18:12" },
            { id: "s3", name: "2026-04-15-071000-CARDIO.fit",   size: 92160,  date: "Apr 15, 2026 · 07:10" },
          ],
          hevyMode: s.hevyMode || "api",
        }));
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("ss-step", String(step));
  }, [step]);

  // Apply tweaks on mount + change
  useEffect(() => {
    applyTweaks(tweaks);
  }, [tweaks]);

  // Tweaks host handshake
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOn(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setTweak = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  const back = () => setStep(s => Math.max(0, s - 1));

  const handleRestart = () => {
    setAppState({
      fitFiles: [], hevyMode: null, hevyFile: null, dragging: false,
      timezone: '', uploadResult: null, matchResult: null, exercises: null, previewResult: null,
    });
    setStep(0);
    localStorage.removeItem('ss-step');
  };

  return (
    <>
      <Shell step={step} setStep={setStep} theme={theme} setTheme={setTheme} tweaksOn={tweaksOn} page={page} setPage={setPage}>
        {page === "library" && <ScreenLibrary onBack={() => setPage("sync")}/>}
        {page === "history" && <ScreenHistory onBack={() => setPage("sync")}/>}
        {page === "settings" && <ScreenSettings onBack={() => setPage("sync")} setPage={setPage}/>}
        {page === "sync" && <div data-screen-label={`0${step+1} ${["Upload","Match","Map","Preview","Export"][step]}`}>
          {step === 0 && <ScreenUpload
            onNext={(data) => { update({ uploadResult: data }); setStep(1); }}
            state={appState}
            update={update}
            setPage={setPage}
          />}
          {step === 1 && <ScreenMatch
            onNext={(data) => { update({ matchResult: data }); setStep(2); }}
            onBack={back}
            state={appState}
            update={update}
          />}
          {step === 2 && <ScreenMap
            onNext={(data) => { update({ exercises: data.exercises }); setStep(3); }}
            onBack={back}
            state={appState}
            update={update}
          />}
          {step === 3 && <ScreenPreview
            onNext={(data) => { update({ previewResult: data }); setStep(4); }}
            onBack={back}
            state={appState}
          />}
          {step === 4 && <ScreenDone state={appState} update={update} onRestart={handleRestart}/>}
        </div>}
      </Shell>

      {/* Tweaks panel */}
      <div className={`tweaks ${tweaksOn ? "on" : ""}`}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <h4 style={{ margin: 0 }}>Tweaks</h4>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>STRENGTHSYNC</span>
        </div>
        <div className="tweaks-row">
          <span>Accent</span>
          <div className="tweaks-swatches">
            {Object.entries(ACCENT_PRESETS).map(([k, v]) => (
              <div key={k}
                className={`tweaks-swatch ${tweaks.accent === k ? "sel" : ""}`}
                style={{ background: v.light }}
                onClick={() => setTweak({ accent: k })}
                title={k}
              />
            ))}
          </div>
        </div>
        <div className="tweaks-row">
          <span>Secondary</span>
          <div className="tweaks-swatches">
            {Object.entries(ACCENT2_PRESETS).map(([k, v]) => (
              <div key={k}
                className={`tweaks-swatch ${tweaks.accent2 === k ? "sel" : ""}`}
                style={{ background: v }}
                onClick={() => setTweak({ accent2: k })}
                title={k}
              />
            ))}
          </div>
        </div>
        <div className="tweaks-row">
          <span>Jump to step</span>
          <select
            value={step}
            onChange={e => setStep(Number(e.target.value))}
            style={{ font: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px", background: "var(--surface)", color: "var(--ink)" }}
          >
            <option value={0}>01 Upload</option>
            <option value={1}>02 Match</option>
            <option value={2}>03 Map</option>
            <option value={3}>04 Preview</option>
            <option value={4}>05 Export</option>
          </select>
        </div>
        <div className="tweaks-row">
          <span>Theme</span>
          <div className="nav-pill" style={{ padding: 2 }}>
            <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} style={{ padding: "4px 10px", fontSize: 10 }}>Light</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} style={{ padding: "4px 10px", fontSize: 10 }}>Dark</button>
          </div>
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
