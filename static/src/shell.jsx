const { useState, useEffect, useMemo, useRef } = React;

// Coin brand colors
const COIN_COLORS = { btc: '#F7931A', eth: '#627EEA' };

function DonateModal({ coin, address, label, symbol, onClose }) {
  const [copied, setCopied] = useState(false);
  const color = COIN_COLORS[coin];

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, boxShadow: 'var(--shadow-lg)', padding: 32, width: 320, position: 'relative' }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: `${color}22`, border: `2px solid ${color}66`, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, color, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
            {symbol}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Scan or copy to donate</div>
          </div>
        </div>

        {/* QR code */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, marginBottom: 20, display: 'flex', justifyContent: 'center', border: `2px solid ${color}44` }}>
          <img
            src={`/api/donation/qr/${coin}?v=2`}
            alt={`${label} QR code`}
            width={200} height={200}
            style={{ display: 'block', borderRadius: 4 }}
          />
        </div>

        {/* Address */}
        <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: 'var(--ink)', wordBreak: 'break-all', marginBottom: 14, lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8, userSelect: 'all', border: '1px solid var(--line)' }}>
          {address}
        </div>

        {/* ERC-20 note */}
        {coin === 'eth' && (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.5 }}>
            ✦ Also accepts USDC, USDT, DAI and other ERC-20 tokens.
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={() => { navigator.clipboard.writeText(address).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: `1.5px solid ${copied ? color : 'var(--line-2)'}`, background: copied ? `${color}18` : 'transparent', color: copied ? color : 'var(--ink-2)', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .15s ease' }}
        >
          {copied ? '✓ Copied to clipboard!' : 'Copy address'}
        </button>
      </div>
    </div>
  );
}

function WelcomeModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, boxShadow: 'var(--shadow-lg)', padding: 32, width: 480, maxWidth: '95vw', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>

        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>Before you sync</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>A few things to know so your data lands correctly.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>📤</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>Verify first, then delete the original</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Use the <strong>Preview merge</strong> step (Step 4) to check all exercise names, sets, reps, and weights before exporting. Once you're happy, <strong>delete the original activity from Garmin Connect</strong>, then upload the merged file. Garmin blocks re-uploading the same timestamp, so you must delete first.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🔄</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>Strava users — expect a duplicate</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                If your Garmin account is linked to Strava, uploading the merged file will auto-sync to Strava as a <em>new</em> activity. You'll need to <strong>delete that duplicate from Strava</strong> manually after it appears.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>Intensity minutes won't update</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Garmin does not award intensity minutes to manually uploaded FIT files — even with accurate heart rate data. This is a Garmin platform limitation, not a bug in StrengthSync.
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: 24, width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          Got it — let's sync
        </button>
      </div>
    </div>
  );
}

function Shell({ step, setStep, theme, setTheme, tweaksOn, page, setPage, children }) {
  const [btcAddress, setBtcAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [donateOpen, setDonateOpen] = useState(null); // null | 'btc' | 'eth'
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem('ss-welcome-seen'));

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

  const DonateBtn = ({ coin, address, label, symbol }) => {
    const color = COIN_COLORS[coin];
    return (
      <button
        onClick={() => setDonateOpen(coin)}
        aria-label={`Donate ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 13px', borderRadius: 999,
          border: `1.5px solid ${color}55`,
          background: `${color}18`,
          color, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontWeight: 800, fontSize: 13, cursor: 'pointer',
          transition: 'all .15s ease', letterSpacing: '-0.01em',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.borderColor = `${color}99`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.borderColor = `${color}55`; }}
      >
        <span style={{ fontSize: 15 }}>{symbol}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{coin.toUpperCase()}</span>
      </button>
    );
  };

  const dismissWelcome = () => { sessionStorage.setItem('ss-welcome-seen', '1'); setShowWelcome(false); };

  return (
    <div className="app">
      {showWelcome && <WelcomeModal onClose={dismissWelcome} />}
      {donateOpen === 'btc' && btcAddress && <DonateModal coin="btc" address={btcAddress} label="Bitcoin (BTC)" symbol="₿" onClose={() => setDonateOpen(null)} />}
      {donateOpen === 'eth' && ethAddress && <DonateModal coin="eth" address={ethAddress} label="Ethereum / ERC-20" symbol="Ξ" onClose={() => setDonateOpen(null)} />}

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
          {/* Donate group — labelled container between nav and theme toggle */}
          {(btcAddress || ethAddress) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 6px 4px 11px',
              borderRadius: 999,
              border: '1.5px solid rgba(247,147,26,0.35)',
              background: 'rgba(247,147,26,0.07)',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: '#F7931A',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}>Donate</span>
              {btcAddress && <DonateBtn coin="btc" address={btcAddress} label="Bitcoin (BTC)" symbol="₿" />}
              {ethAddress && <DonateBtn coin="eth" address={ethAddress} label="Ethereum / ERC-20" symbol="Ξ" />}
            </div>
          )}
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
