const { useState, useEffect, useMemo, useRef } = React;

function DonatePopover({ coin, address, label, symbol }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={`Donate ${label}`}
        title={`Donate ${label}`}
        style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700, fontSize: 13, color: open ? 'var(--ink)' : 'var(--ink-3)' }}
      >
        {symbol}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-lg)',
          padding: 20, width: 260, zIndex: 200,
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>
            {label}
          </div>
          <img
            src={`/api/donation/qr/${coin}`}
            alt={`${label} QR code`}
            width={128} height={128}
            style={{ display: 'block', margin: '0 auto 14px', borderRadius: 6, background: '#fff', padding: 4 }}
          />
          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--ink-2)', wordBreak: 'break-all', marginBottom: 10, lineHeight: 1.5 }}>
            {address}
          </div>
          {coin === 'eth' && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Also accepts USDC, USDT, DAI and other ERC-20 tokens.
            </div>
          )}
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { navigator.clipboard.writeText(address).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          >
            {copied ? '✓ Copied!' : 'Copy address'}
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({ step, setStep, theme, setTheme, tweaksOn, page, setPage, children }) {
  const [btcAddress, setBtcAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => {
      setBtcAddress(d.btc_address || '');
      setEthAddress(d.eth_address || '');
    }).catch(() => {});
  }, []);

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
            <div>StrengthSync</div>
          </div>
          <div className="nav-pill" role="tablist">
            {[["sync","Sync"],["library","Library"],["history","History"],["settings","Settings"]].map(([p, label]) => (
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
          {btcAddress && <DonatePopover coin="btc" address={btcAddress} label="Bitcoin (BTC)" symbol="₿" />}
          {ethAddress && <DonatePopover coin="eth" address={ethAddress} label="Ethereum / ERC-20" symbol="Ξ" />}
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
