import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

// ─────────────────────────────────────────────────────────
//  DATA — Taals and Ragas
// ─────────────────────────────────────────────────────────

const TAALS = [
  {
    id: "teentaal",
    name: "Teentaal",
    beats: 16,
    pattern: "4+4+4+4",
    sam: [0],
    khali: [8],
  },
  {
    id: "rupak",
    name: "Rupak",
    beats: 7,
    pattern: "3+2+2",
    sam: [3],
    khali: [0],
  },
  {
    id: "ektaal",
    name: "Ektaal",
    beats: 12,
    pattern: "2+2+2+2+2+2",
    sam: [0],
    khali: [6],
  },
];

const RAGAS = [
  { id: "yaman",    name: "Yaman",    time: "Evening" },
  { id: "bhairav",  name: "Bhairav",  time: "Dawn"    },
  { id: "bhairavi", name: "Bhairavi", time: "Morning" },
  { id: "kafi",     name: "Kafi",     time: "Night"   },
];

// ─────────────────────────────────────────────────────────
//  HYBRID AUDIO SYSTEM
//
//  Structure:
//    getBPMRange(bpm)         → "slow" | "medium" | "fast"
//    getAudioFile(raga, bpm)  → "/audio/yaman_medium.mp3"
//
//  For now: 3 BPM ranges, 1 MP3 per range per raga
//  Future:  can add more ranges, crossfade, pitch shift etc.
// ─────────────────────────────────────────────────────────

function getBPMRange(bpm) {
  if (bpm <= 85)  return "slow";
  if (bpm <= 140) return "medium";
  return "fast";
}

function getAudioFile(ragaId, bpm) {
  const range = getBPMRange(bpm);
  // Returns path relative to /public folder
  return `/audio/${ragaId}_${range}.mp3`;
}

// BPM range definitions for the UI indicator
const BPM_RANGES = [
  { key: "slow",   label: "Vilambit", range: "60–85"   },
  { key: "medium", label: "Madhya",   range: "86–140"  },
  { key: "fast",   label: "Drut",     range: "141–200" },
];

// ─────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export default function App() {

  // ── State ──────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentBeat,  setCurrentBeat]  = useState(-1);
  const [bpm,          setBpm]          = useState(100);
  const [metroOn,      setMetroOn]      = useState(false);
  const [selectedTaal, setSelectedTaal] = useState(TAALS[0]);
  const [selectedRaga, setSelectedRaga] = useState(RAGAS[0]);
  const [audioError,   setAudioError]   = useState(false);
  const [currentFile,  setCurrentFile]  = useState("");

  // ── Refs ───────────────────────────────────────────────
  // Main lehra audio
  const audioRef    = useRef(null);

  // Metronome uses Web Audio API — lightweight, no library needed
  const audioCtxRef = useRef(null);

  // Beat interval timer
  const beatTimerRef   = useRef(null);
  const beatCountRef   = useRef(0);
  const lastBpmRef     = useRef(bpm);
  const lastRagaRef    = useRef(selectedRaga.id);

  // ─────────────────────────────────────────────────────
  //  METRONOME — Web Audio API beep (no Tone.js needed)
  // ─────────────────────────────────────────────────────

  const playClick = useCallback((isSam) => {
    if (!metroOn) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Sam beat: lower woodblock tone, other beats: higher
      osc.frequency.value = isSam ? 600 : 900;
      osc.type = "square";

      gain.gain.setValueAtTime(isSam ? 0.3 : 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {
      // Metronome is optional — silent fail
    }
  }, [metroOn]);

  // ─────────────────────────────────────────────────────
  //  BEAT TRACKER — simple setInterval approach
  //  Runs independently of audio playback
  // ─────────────────────────────────────────────────────

  const startBeatTracker = useCallback((taal, currentBpm) => {
    // Clear any existing timer first
    if (beatTimerRef.current) clearInterval(beatTimerRef.current);

    beatCountRef.current = 0;
    const intervalMs = (60 / currentBpm) * 1000; // one beat in ms

    beatTimerRef.current = setInterval(() => {
      const beat = beatCountRef.current % taal.beats;
      setCurrentBeat(beat);
      playClick(taal.sam.includes(beat));
      beatCountRef.current++;
    }, intervalMs);
  }, [playClick]);

  const stopBeatTracker = useCallback(() => {
    if (beatTimerRef.current) {
      clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    beatCountRef.current = 0;
    setCurrentBeat(-1);
  }, []);

  // ─────────────────────────────────────────────────────
  //  AUDIO — HTML5 Audio playback
  //  Uses the <audio> element for seamless looping
  // ─────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    // Stop HTML5 audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Stop beat tracker
    stopBeatTracker();
    setIsPlaying(false);
    setAudioError(false);
  }, [stopBeatTracker]);

  const startAudio = useCallback(async () => {
    // Safety: stop anything already playing
    stopAudio();

    const filePath = getAudioFile(selectedRaga.id, bpm);
    setCurrentFile(filePath);
    setAudioError(false);

    // Create fresh Audio element each time
    // This avoids overlap and stale state issues
    const audio = new Audio(filePath);
    audio.loop  = true;   // seamless HTML5 looping
    audioRef.current = audio;

    // Handle load error (file missing)
    audio.onerror = () => {
      setAudioError(true);
      setIsPlaying(false);
      stopBeatTracker();
    };

    // Handle unexpected stop
    audio.onended = () => {
      // loop=true means this won't fire during normal playback
      // Only fires if loop somehow breaks
      stopAudio();
    };

    try {
      await audio.play();
      setIsPlaying(true);
      startBeatTracker(selectedTaal, bpm);
    } catch (err) {
      // Browser blocked autoplay or file missing
      setAudioError(true);
      setIsPlaying(false);
    }
  }, [bpm, selectedRaga, selectedTaal, stopAudio, startBeatTracker, stopBeatTracker]);

  // ─────────────────────────────────────────────────────
  //  BPM CHANGE
  //  When BPM crosses a range boundary while playing,
  //  reload the appropriate MP3 automatically.
  // ─────────────────────────────────────────────────────

  const handleBpm = (e) => {
    const val = Number(e.target.value);
    const prevRange = getBPMRange(lastBpmRef.current);
    const newRange  = getBPMRange(val);

    setBpm(val);
    lastBpmRef.current = val;

    if (isPlaying) {
      // Restart beat tracker at new speed immediately
      startBeatTracker(selectedTaal, val);

      // If we crossed a BPM range boundary, swap the MP3
      if (prevRange !== newRange) {
        const audio = audioRef.current;
        if (audio) {
          const newFile = getAudioFile(selectedRaga.id, val);
          audio.src = newFile;
          audio.load();
          audio.loop = true;
          audio.play().catch(() => setAudioError(true));
          setCurrentFile(newFile);
        }
      }
    }
  };

  // ─────────────────────────────────────────────────────
  //  TAAL / RAGA CHANGE
  // ─────────────────────────────────────────────────────

  const handleTaal = (taal) => {
    if (isPlaying) stopAudio();
    setSelectedTaal(taal);
  };

  const handleRaga = (raga) => {
    if (isPlaying) stopAudio();
    setSelectedRaga(raga);
    lastRagaRef.current = raga.id;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [stopAudio]);

  // ─────────────────────────────────────────────────────
  //  DERIVED VALUES
  // ─────────────────────────────────────────────────────
  const currentRange = getBPMRange(bpm);

  // ─────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div className="riyaz-app">
      <div className="container" style={{ maxWidth: 700 }}>

        {/* ── Header ── */}
        <div className="riyaz-header">
          <div className="riyaz-logo">
            Riyaz{" "}
            <span className="riyaz-logo-accent">Studio</span>
          </div>
          <div className="riyaz-tagline">
            Indian Classical Practice Tool
          </div>
          <div>
            <span className={`riyaz-status ${isPlaying ? "playing" : ""}`}>
              <span className="status-dot" />
              {isPlaying ? "Playing" : "Ready"}
            </span>
          </div>
        </div>

        {/* ── Beat Tracker ── */}
        <div className="rs-card">
          <div className="rs-section-label">
            Beat Tracker — {selectedTaal.name}
          </div>
          <div className="beat-grid">
            {Array.from({ length: selectedTaal.beats }).map((_, i) => (
              <div
                key={i}
                className={[
                  "beat-cell",
                  selectedTaal.sam.includes(i)   ? "sam"    : "",
                  selectedTaal.khali.includes(i) ? "khali"  : "",
                  i === currentBeat              ? "active"  : "",
                ].filter(Boolean).join(" ")}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="beat-legend">
            <div className="legend-chip">
              <div
                className="legend-swatch"
                style={{ background: "#b8722a" }}
              />
              Sam — first beat
            </div>
            <div className="legend-chip">
              <div
                className="legend-swatch"
                style={{ background: "#c05060" }}
              />
              Khali — empty
            </div>
            <div className="legend-chip">
              <div
                className="legend-swatch"
                style={{ background: "#e0d0ba" }}
              />
              Normal beat
            </div>
          </div>
        </div>

        {/* ── Taal Selector ── */}
        <div className="rs-card">
          <div className="rs-section-label">Select Taal</div>
          <div className="sel-grid-3">
            {TAALS.map((t) => (
              <button
                key={t.id}
                className={`sel-btn ${t.id === selectedTaal.id ? "active" : ""}`}
                onClick={() => handleTaal(t)}
              >
                <span className="sel-btn-name">{t.name}</span>
                <span className="sel-btn-sub">{t.beats} beats</span>
                <span className="sel-btn-sub">{t.pattern}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Raga Selector ── */}
        <div className="rs-card">
          <div className="rs-section-label">Select Raga</div>
          <div className="sel-grid-2">
            {RAGAS.map((r) => (
              <button
                key={r.id}
                className={`sel-btn ${r.id === selectedRaga.id ? "active" : ""}`}
                onClick={() => handleRaga(r)}
              >
                <span className="sel-btn-name">{r.name}</span>
                <span className="sel-btn-sub">{r.time}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tempo ── */}
        <div className="rs-card">
          <div className="rs-section-label">Tempo</div>
          <div className="bpm-display">
            <span className="bpm-number">{bpm}</span>
            <span className="bpm-unit">BPM</span>
            <span className="bpm-note">
              {BPM_RANGES.find((r) => r.key === currentRange)?.label}
            </span>
          </div>
          <input
            type="range"
            className="rs-slider"
            min="60"
            max="200"
            step="1"
            value={bpm}
            onChange={handleBpm}
          />
          <div className="slider-labels">
            <span>60 Slow</span>
            <span>130 Medium</span>
            <span>200 Fast</span>
          </div>

          {/* BPM range indicator — shows which MP3 is active */}
          <div className="bpm-range-bar">
            {BPM_RANGES.map((r) => (
              <div
                key={r.key}
                className={`bpm-range-item ${
                  currentRange === r.key ? "active-range" : ""
                }`}
              >
                <span className="bpm-range-label">{r.label}</span>
                <span className="bpm-range-val">{r.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Metronome ── */}
        <div className="rs-card">
          <div className="rs-section-label">Metronome Click</div>
          <div className="metro-row">
            <button
              className={`metro-btn ${metroOn ? "on" : ""}`}
              onClick={() => setMetroOn((v) => !v)}
            >
              {metroOn ? "● Click On" : "○ Click Off"}
            </button>
            <div className="metro-lights">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`metro-light ${
                    isPlaying && metroOn && currentBeat % 4 === i
                      ? "flash"
                      : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Audio Info ── */}
        <div className="rs-card">
          <div className="rs-section-label">Audio System</div>
          <div className="audio-info-panel">
            <div className="audio-info-title">Hybrid Audio Engine</div>
            <div className="audio-info-row">
              <span className="audio-info-key">System</span>
              <span className="audio-info-val">HTML5 Audio + Web Audio API</span>
            </div>
            <div className="audio-info-row">
              <span className="audio-info-key">Raga</span>
              <span className="audio-info-val">{selectedRaga.name}</span>
            </div>
            <div className="audio-info-row">
              <span className="audio-info-key">Laya</span>
              <span className="audio-info-val">
                {BPM_RANGES.find((r) => r.key === currentRange)?.label} ({bpm} BPM)
              </span>
            </div>
            <div className="audio-info-row">
              <span className="audio-info-key">File</span>
              <span className="audio-info-val" style={{ fontSize: 10 }}>
                {currentFile || "—"}
              </span>
            </div>
            <div className="audio-info-row">
              <span className="audio-info-key">Loop</span>
              <span className="audio-info-val">Seamless HTML5</span>
            </div>
            <div className="audio-info-row">
              <span className="audio-info-key">Status</span>
              <span className="audio-info-val">
                {isPlaying ? "▶ Playing" : "■ Stopped"}
              </span>
            </div>
          </div>

          {/* Error state — file missing */}
          {audioError && (
            <div className="audio-warning">
              ⚠ Audio file not found:{" "}
              <strong>{currentFile}</strong>. Place your MP3 in{" "}
              <code>public/audio/</code>
            </div>
          )}
        </div>

        {/* ── Transport ── */}
        <div className="transport-row">
          <button
            className="btn-play"
            onClick={startAudio}
            disabled={isPlaying}
          >
            <span className="btn-play-circle">▶</span>
            Play Lehra
          </button>
          <button
            className="btn-stop"
            onClick={stopAudio}
            disabled={!isPlaying}
          >
            ■
          </button>
        </div>

      </div>
    </div>
  );
}