import { useEffect, useRef } from "react";

export default function Waveform({ getAnalyser, isPlaying }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const analyser = getAnalyser();

      if (!isPlaying || !analyser) {
        ctx.strokeStyle = "#1e1e2c";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        if (isPlaying) animRef.current = requestAnimationFrame(draw);
        return;
      }

      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);

      // Glow layer
      ctx.strokeStyle = "rgba(240,192,96,0.15)";
      ctx.lineWidth   = 5;
      ctx.beginPath();
      buf.forEach((v, i) => {
        const x = (i / buf.length) * W;
        const y = H / 2 + v * H * 1.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Main line
      ctx.strokeStyle = "#f0c060";
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      buf.forEach((v, i) => {
        const x = (i / buf.length) * W;
        const y = H / 2 + v * H * 1.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, getAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={80}
      style={{ width: "100%", height: 80, display: "block", borderRadius: 6 }}
    />
  );
}
