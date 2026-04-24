import { useState, useRef, useEffect } from "react";
import "./Dropdown.css";

export default function TaalDropdown({ taals, selected, onChange }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef(null);
  const inputRef          = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setQuery("");
  }, [open]);

  const filtered = taals.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  function select(taal) {
    onChange(taal);
    setTimeout(() => setOpen(false), 160);
  }

  return (
    <div className="dd-block" ref={ref}>
      <p className="dd-label">Taal</p>

      <div className={`dd-trigger ${open ? "open" : ""}`} onClick={() => setOpen(v => !v)}>
        <div className="dd-selected">
          <div className="dd-icon" style={{ background: selected.color }}>
            <span style={{ color: selected.accent, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
              {selected.beats}
            </span>
          </div>
          <div className="dd-text">
            <span className="dd-name">{selected.name}</span>
            <span className="dd-meta">{selected.beats} beats · {selected.pattern}</span>
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
                placeholder="Search taal..."
              />
            </div>
            <div className="dd-list">
              {filtered.map(t => (
                <div
                  key={t.id}
                  className={`dd-item ${t.id === selected.id ? "active" : ""}`}
                  onClick={() => select(t)}
                >
                  <div className="item-icon" style={{ background: t.color }}>
                    <span style={{ color: t.accent, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
                      {t.beats}
                    </span>
                  </div>
                  <div className="item-text">
                    <span className="item-name">{t.name}</span>
                    <span className="item-desc">{t.pattern}</span>
                  </div>
                  <span className="tag tag-beats">{t.feel}</span>
                  <div className="check">{t.id === selected.id && <div className="check-dot" />}</div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="dd-empty">No taals found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}