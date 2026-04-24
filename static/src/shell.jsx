const { useState, useEffect, useMemo, useRef } = React;

function Shell({ step, setStep, theme, setTheme, tweaksOn, children }) {
  const steps = [
    { key: 0, label: "Upload" },
    { key: 1, label: "Match workouts" },
    { key: 2, label: "Map exercises" },
    { key: 3, label: "Preview merge" },
    { key: 4, label: "Export" },
  ];
  return (
    <div className="app">
      <div className="topbar">
        <div className="row" style={{ gap: 20 }}>
          <div className="brand">
            <div className="brand-mark"><span>S</span></div>
            <div>StrengthSync<em>/v1.0</em></div>
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? <IconSun/> : <IconMoon/>}
          </button>
        </div>
      </div>

      <div className="rail">
        {steps.map(s => {
          const status =
            s.key < step ? "done" :
            s.key === step ? "active" : "";
          return (
            <div
              key={s.key}
              className={`rail-step ${status}`}
              onClick={() => { if (s.key <= step) setStep(s.key); }}
              role="button"
              tabIndex={0}
            >
              <div className="meta">
                <span className="num">0{s.key + 1}</span>
                <span>{status === "done" ? "DONE" : status === "active" ? "NOW" : "NEXT"}</span>
              </div>
              <div className="bar"></div>
              <div className="label">{s.label}</div>
            </div>
          );
        })}
      </div>

      <main>{children}</main>
    </div>
  );
}

window.Shell = Shell;
