import { useState, useRef, useCallback } from "react";
import * as Tone from "tone";

// Generates a melodic phrase that walks step-by-step through raga notes
function buildPhrase(raga, taal) {
  const n = raga.notes;
  const phrase = [];

  for (let i = 0; i < taal.beats; i++) {
    if (i === 0) {
      phrase.push(n[0]); // Always start on Sa (root)
    } else if (i % 4 === 0) {
      phrase.push(n[Math.floor(Math.random() * n.length)]); // New section: leap
    } else {
      // Step-wise movement ±1–3 notes
      const prev = phrase[i - 1];
      const idx = n.indexOf(prev);
      const step = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
      const next = Math.max(0, Math.min(n.length - 1, idx + step));
      phrase.push(n[next]);
    }
  }
  return phrase;
}

export function useLehraEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [bpm, setBpm] = useState(100);
  const [volume, setVolume] = useState(80);

  const synthRef    = useRef(null);
  const metroRef    = useRef(null);
  const loopRef     = useRef(null);
  const analyserRef = useRef(null);
  const phraseRef   = useRef([]);
  const noteIdxRef  = useRef(0);

  const start = useCallback(async (raga, taal, metroOn) => {
    await Tone.start();
    Tone.Transport.bpm.value = bpm;

    phraseRef.current = buildPhrase(raga, taal);
    noteIdxRef.current = 0;

    // --- Analyser for waveform visualizer ---
    const rawCtx = Tone.getContext().rawContext;
    analyserRef.current = rawCtx.createAnalyser();
    analyserRef.current.fftSize = 512;

    // --- Lehra synth (triangle wave = sarangi/harmonium feel) ---
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.8 },
      volume: Tone.gainToDb(volume / 100),
    }).toDestination();

    // Wire analyser
    try {
      synthRef.current.connect(analyserRef.current);
      analyserRef.current.connect(rawCtx.destination);
    } catch (_) {}

    // --- Optional metronome click ---
    if (metroOn) {
      metroRef.current = new Tone.MetalSynth({
        frequency: 600,
        envelope: { attack: 0.001, decay: 0.05, release: 0.05 },
        harmonicity: 5,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        volume: -20,
      }).toDestination();
    }

    // --- Main loop ---
    let beatCount = -1;
    loopRef.current = new Tone.Loop((time) => {
      beatCount = (beatCount + 1) % taal.beats;

      const freq = phraseRef.current[noteIdxRef.current % phraseRef.current.length];
      // Sam gets a longer note; other beats get quarter notes
      const dur = taal.sam.includes(beatCount) ? "2n" : "4n";

      synthRef.current.triggerAttackRelease(freq, dur, time);

      if (metroOn && metroRef.current) {
        metroRef.current.triggerAttackRelease("16n", time);
      }

      noteIdxRef.current++;

      // Schedule UI update on the draw thread (not audio thread)
      Tone.getDraw().schedule(() => {
        setCurrentBeat(beatCount);
      }, time);
    }, "4n");

    loopRef.current.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
    setCurrentBeat(-1);
  }, [bpm, volume]);

  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (loopRef.current)  { loopRef.current.dispose();  loopRef.current = null; }
    if (synthRef.current) { synthRef.current.dispose(); synthRef.current = null; }
    if (metroRef.current) { metroRef.current.dispose(); metroRef.current = null; }
    analyserRef.current = null;
    setIsPlaying(false);
    setCurrentBeat(-1);
    noteIdxRef.current = 0;
  }, []);

  const updateBpm = useCallback((val) => {
    setBpm(val);
    Tone.Transport.bpm.value = val;
  }, []);

  const updateVolume = useCallback((val) => {
    setVolume(val);
    if (synthRef.current) {
      synthRef.current.volume.value = Tone.gainToDb(val / 100);
    }
  }, []);

  return {
    isPlaying, currentBeat, bpm, volume,
    analyser: analyserRef.current,
    start, stop, updateBpm, updateVolume,
  };
}