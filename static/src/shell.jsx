const { useState, useEffect, useMemo, useRef } = React;

function Shell({ step, setStep, theme, setTheme, tweaksOn, page, setPage, children }) {
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
        <div className="row" style={{ gap: 16 }}>
          <div className="brand">
            <div className="brand-mark"><span>S</span></div>
            <div>StrengthSync<em>/v1.0</em></div>
          </div>
          <div className="nav-pill" role="tablist">
            {[["sync","Sync"],["library","Library"],["history","History"]].map(([p, label]) => (
              <button
                key={p}
                className={page === p ? "active" : ""}
                onClick={() => setPage(p)}
                role="tab"
              >{label}</button>
            ))}
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

      {page === "sync" && (
        <div className="rail">
          {steps.map((s, idx) => {
            const status = s.key < step ? "done" : s.key === step ? "active" : "";
            return (
              <React.Fragment key={s.key}>
                <div
                  className={`rail-step ${status}`}
                  onClick={() => { if (s.key <= step) setStep(s.key); }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="rail-num">{status === "done" ? "✓" : `0${s.key + 1}`}</span>
                  <span className="rail-lbl">{s.label}</span>
                </div>
                {idx < steps.length - 1 && <div className="rail-sep"/>}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}

window.Shell = Shell;
