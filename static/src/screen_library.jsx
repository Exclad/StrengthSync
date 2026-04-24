// Screen: Library — view and edit saved Hevy→Garmin exercise mappings
function ScreenLibrary({ onBack }) {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allGarmin, setAllGarmin] = useState([]);
  const [editId, setEditId] = useState(null);       // hevy_name being edited
  const [suggestions, setSuggestions] = useState([]);
  const [editSearch, setEditSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/mappings').then(r => r.json()),
      fetch('/api/exercises').then(r => r.json()),
    ]).then(([maps, exercises]) => {
      setMappings(maps);
      setAllGarmin(exercises);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startEdit = (hevyName) => {
    setEditId(hevyName);
    setEditSearch('');
    setSuggestions([]);
    fetch('/api/map/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hevy_exercise_name: hevyName }),
    }).then(r => r.json()).then(b => setSuggestions(b.suggestions || [])).catch(() => {});
  };

  const handleConfirm = (hevyName, garminId) => {
    setSaving(true);
    fetch('/api/map/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hevy_name: hevyName, garmin_name: garminId }),
    }).then(() => {
      setMappings(prev => prev.map(m =>
        m.hevy_name === hevyName ? { ...m, garmin_name: garminId } : m
      ));
      setEditId(null);
      setSaving(false);
    }).catch(() => setSaving(false));
  };

  const handleDelete = (hevyName) => {
    fetch('/api/map/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hevy_name: hevyName }),
    }).then(() => {
      setMappings(prev => prev.filter(m => m.hevy_name !== hevyName));
      setConfirmDelete(null);
    }).catch(() => {});
  };

  const filtered = mappings.filter(m =>
    !filter ||
    m.hevy_name.toLowerCase().includes(filter.toLowerCase()) ||
    m.garmin_name.toLowerCase().includes(filter.toLowerCase())
  );

  const garminFiltered = allGarmin.filter(ex =>
    !editSearch ||
    ex.exercise_name.toLowerCase().includes(editSearch.toLowerCase()) ||
    ex.exercise_category.toLowerCase().includes(editSearch.toLowerCase())
  );

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p className="h-eyebrow" style={{ marginBottom: 4 }}>LIBRARY / EXERCISE MAPPINGS</p>
          <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>
            {loading ? <>Loading&hellip;</> : <>{mappings.length} <em>saved mappings</em></>}
          </h1>
        </div>
        <span className="chip neutral mono" style={{ fontSize: 10 }}>PERSISTED TO DATABASE</span>
      </div>

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Loading mappings…</div>
      )}

      {!loading && mappings.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <IconDumbbell size={28} style={{ color: 'var(--ink-3)', marginBottom: 12 }}/>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No mappings saved yet</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>
            Mappings are saved automatically when you confirm exercises in the Map step.
            They persist across sessions so future workouts auto-map faster.
          </div>
        </div>
      )}

      {!loading && mappings.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Search bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSearch size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={`Search ${mappings.length} mappings…`}
              style={{ border: 0, background: 'transparent', outline: 'none', font: 'inherit', color: 'inherit', flex: 1, fontSize: 13 }}
            />
            {filter && <button onClick={() => setFilter('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>}
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{filtered.length}</span>
          </div>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 0, padding: '8px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
            <span className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)' }}>Hevy exercise</span>
            <span className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)' }}>→ Garmin exercise</span>
            <span className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)', width: 100, textAlign: 'right' }}>Actions</span>
          </div>

          {/* Mapping rows */}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {filtered.map(m => (
              <div key={m.hevy_name}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, paddingRight: 12 }}>{m.hevy_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', paddingRight: 12 }}>
                    {m.garmin_name.replace(/_/g, ' ')}
                  </div>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end', width: 100 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => editId === m.hevy_name ? setEditId(null) : startEdit(m.hevy_name)}
                    >
                      {editId === m.hevy_name ? 'Cancel' : 'Change'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 12, padding: '5px 10px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--warn)', borderRadius: 8 }}
                      onClick={() => setConfirmDelete(m.hevy_name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editId === m.hevy_name && (
                  <div style={{ padding: '12px 16px 16px', background: 'color-mix(in oklab, var(--accent) 5%, var(--surface))', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                      Top suggestions for <strong style={{ color: 'var(--ink)' }}>{m.hevy_name}</strong>:
                    </div>
                    {suggestions.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 8 }}
                            onClick={() => handleConfirm(m.hevy_name, s.id)}
                            disabled={saving}
                          >
                            {s.label} <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>{s.score}%</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Or search all Garmin exercises:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', marginBottom: 8 }}>
                      <IconSearch size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
                      <input
                        value={editSearch}
                        onChange={e => setEditSearch(e.target.value)}
                        placeholder="Search Garmin exercises…"
                        style={{ border: 0, background: 'transparent', outline: 'none', font: 'inherit', color: 'inherit', flex: 1, fontSize: 12 }}
                        autoFocus
                      />
                    </div>
                    {editSearch && (
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)' }}>
                        {garminFiltered.slice(0, 20).map(ex => (
                          <button
                            key={ex.exercise_name}
                            onClick={() => handleConfirm(m.hevy_name, ex.exercise_name)}
                            disabled={saving}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 12px', border: 0, borderBottom: '1px solid var(--line)', background: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                          >
                            <span style={{ fontSize: 12 }}>{ex.exercise_name.replace(/_/g, ' ')}</span>
                            <span className="chip neutral" style={{ fontSize: 9 }}>{ex.exercise_category.replace(/_/g, ' ')}</span>
                          </button>
                        ))}
                        {garminFiltered.length === 0 && (
                          <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-3)' }}>No matches for "{editSearch}"</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No mappings match "{filter}"</div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ padding: 28, maxWidth: 380, width: '90%' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete mapping?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
              <strong style={{ color: 'var(--ink)' }}>{confirmDelete}</strong> will be removed from the database.
              Future workouts will need to re-map this exercise.
            </div>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--warn)', color: '#fff', border: 'none' }}
                onClick={() => handleDelete(confirmDelete)}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.ScreenLibrary = ScreenLibrary;
