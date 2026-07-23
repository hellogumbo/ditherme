"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

type CameraState = "idle" | "requesting" | "live" | "error";

function paintDitheredFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  pixelSize: number,
  contrast: number,
  threshold: number,
) {
  if (video.readyState < 2 || !video.videoWidth) return;

  const outputWidth = video.videoWidth;
  const outputHeight = video.videoHeight;
  const sampleWidth = Math.max(1, Math.floor(outputWidth / pixelSize));
  const sampleHeight = Math.max(1, Math.floor(outputHeight / pixelSize));

  if (canvas.width !== sampleWidth || canvas.height !== sampleHeight) {
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
  }
  scratch.width = sampleWidth;
  scratch.height = sampleHeight;

  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  const outputContext = canvas.getContext("2d");
  if (!scratchContext || !outputContext) return;

  scratchContext.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const frame = scratchContext.getImageData(0, 0, sampleWidth, sampleHeight);
  const factor = contrast / 100;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const luminance =
        frame.data[index] * 0.2126 +
        frame.data[index + 1] * 0.7152 +
        frame.data[index + 2] * 0.0722;
      const adjusted = Math.max(0, Math.min(255, (luminance - 128) * factor + 128));
      const orderedOffset = (BAYER_4X4[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 92;
      const ink = adjusted > threshold + orderedOffset ? 255 : 0;

      // Acid-lime paper against near-black ink.
      frame.data[index] = ink ? 200 : 23;
      frame.data[index + 1] = ink ? 255 : 26;
      frame.data[index + 2] = ink ? 61 : 20;
      frame.data[index + 3] = 255;
    }
  }

  outputContext.putImageData(frame, 0, 0);
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [message, setMessage] = useState("Ready when you are");
  const [pixelSize, setPixelSize] = useState(6);
  const [contrast, setContrast] = useState(118);
  const [threshold, setThreshold] = useState(128);
  const [mirrored, setMirrored] = useState(true);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
    setMessage("Camera paused");
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (cameraState !== "live") return;
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const scratch = scratchRef.current;
      if (video && canvas && scratch) {
        paintDitheredFrame(video, canvas, scratch, pixelSize, contrast, threshold);
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraState, contrast, pixelSize, threshold]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setMessage("Camera access is not supported in this browser");
      return;
    }

    setCameraState("requesting");
    setMessage("Waiting for camera permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState("live");
      setMessage("Live · processed on this device");
    } catch {
      setCameraState("error");
      setMessage("Camera permission was not granted");
    }
  };

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Dither me home">
          dither me<span aria-hidden="true">.</span>
        </a>
        <p>real-time browser dithering</p>
        <span className="edition">DM—01</span>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">Turn your camera into one-bit moving type.</p>
        <h1>Your face,<br /><span>reduced beautifully.</span></h1>
        <p className="lede">A tiny live studio that redraws every frame with an ordered Bayer matrix. Nothing is recorded or uploaded.</p>
      </section>

      <section className="studio" aria-label="Camera dither studio">
        <div className={`camera-card${mirrored ? " is-mirrored" : ""}`}>
          <video ref={videoRef} className="source-video" muted playsInline aria-hidden="true" />
          <canvas ref={canvasRef} className="dither-canvas" aria-label="Live dithered camera preview" />
          <canvas ref={scratchRef} className="scratch-canvas" aria-hidden="true" />
          {cameraState !== "live" && (
            <div className="camera-placeholder" aria-hidden="true">
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <div className="figure"><i /><b /></div>
              <div className="matrix" />
            </div>
          )}
          <div className="preview-topline">
            <span>CAMERA / 01</span>
            <span>BAYER 4×4</span>
          </div>
          <div className="live-chip">
            <i className={cameraState === "live" ? "active" : ""} />
            {message}
          </div>
        </div>

        <aside className="control-card" aria-label="Dither controls">
          <div className="control-heading">
            <span>Controls</span>
            <strong>01—04</strong>
          </div>

          <label className="select-control">
            <span>Effect</span>
            <select aria-label="Dither effect" defaultValue="bayer">
              <option value="bayer">Bayer 4×4</option>
            </select>
          </label>

          <label className="range-control">
            <span>Pixel size <output>{pixelSize} px</output></span>
            <input type="range" min="2" max="14" value={pixelSize} onChange={(event) => setPixelSize(Number(event.target.value))} />
          </label>

          <label className="range-control">
            <span>Contrast <output>{contrast}%</output></span>
            <input type="range" min="60" max="190" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} />
          </label>

          <label className="range-control">
            <span>Threshold <output>{threshold}</output></span>
            <input type="range" min="70" max="190" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
          </label>

          <label className="toggle-control">
            <span>Mirror camera</span>
            <input type="checkbox" checked={mirrored} onChange={(event) => setMirrored(event.target.checked)} />
            <i aria-hidden="true" />
          </label>

          <button
            className="camera-button"
            type="button"
            onClick={cameraState === "live" ? stopCamera : startCamera}
            disabled={cameraState === "requesting"}
          >
            <span>{cameraState === "live" ? "Stop camera" : cameraState === "requesting" ? "Starting…" : "Start camera"}</span>
            <b aria-hidden="true">→</b>
          </button>

          <p className="privacy">Your camera stays on this device.<br />No account. No upload. No trace.</p>
        </aside>
      </section>

      <footer>
        <p>Made for faces, gestures, and happy accidents.</p>
        <div className="pixel-row" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      </footer>
    </main>
  );
}
