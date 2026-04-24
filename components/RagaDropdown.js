import { useState, useRef, useEffect } from "react";
import "./Dropdown.css";

export default function RagaDropdown({ ragas, selected, onChange }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const ref                 = useRef(null);
  const inputRef            = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setQuery("");
  }, [open]);

  const filtered = ragas.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  function select(raga) {
    onChange(raga);
    setTimeout(() => setOpen(false), 160);
  }

  return (
    <div className="dd-block" ref={ref}>
      <p className="dd-label">Raga</p>

      <div className={`dd-trigger ${open ? "open" : ""}`} onClick={() => setOpen(v => !v)}>
        <div className="dd-selected">
          <div className="dd-icon" style={{ background: selected.color }}>
            <span style={{ color: selected.accent, fontSize: 16 }}>{selected.icon}</span>
          </div>
          <div className="dd-text">
            <span className="dd-name">{selected.name}</span>
            <span className="dd-meta">{selected.time} · {selected.thaat} thaat</span>
          </div>
          <span className={`dd-arrow ${open ? "flipped" : ""}`}>▾</span>
        </div>

        {open && (
          <div className="dd-panel" onClick={e => e.stopPropagation()}>
            <div className="dd-search">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search raga..."
              />
            </div>
            <div className="dd-list">
              {filtered.map(r => (
                <div
                  key={r.id}
                  className={`dd-item ${r.id === selected.id ? "active" : ""}`}
                  onClick={() => select(r)}
                >
                  <div className="item-icon" style={{ background: r.color }}>
                    <span style={{ color: r.accent, fontSize: 14 }}>{r.icon}</span>
                  </div>
                  <div className="item-text">
                    <span className="item-name">{r.name}</span>
                    <span className="item-desc">{r.thaat} thaat · {r.notes} notes</span>
                  </div>
                  <span className="tag tag-time">{r.time}</span>
                  <div className="check">{r.id === selected.id && <div className="check-dot" />}</div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="dd-empty">No ragas found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}