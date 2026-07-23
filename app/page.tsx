"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

type CameraState = "idle" | "requesting" | "live" | "error";
type DitherEffect = "bayer" | "floyd" | "threshold";
type CaptureResult = { url: string; kind: "photo" | "gif"; size: number; filename: string };

const COLOR_PRESETS = ["#c8ff3d", "#2563eb", "#d65c73", "#6a9d62", "#f97316"];
const EFFECTS: Array<{ id: DitherEffect; label: string; detail: string }> = [
  { id: "bayer", label: "Bayer", detail: "4×4 matrix" },
  { id: "floyd", label: "Floyd", detail: "diffusion" },
  { id: "threshold", label: "Hard", detail: "threshold" },
];
const GUMBO_URL = "https://hellogumbo.com/?utm_source=ditherme&utm_medium=referral&utm_campaign=open_source";
const GIF_DURATION_SECONDS = 5;
const GIF_FRAMES_PER_SECOND = 10;

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2 11c0-2.8 0-4.2.545-5.27A5 5 0 0 1 4.73 3.545C5.8 3 7.2 3 10 3h4c2.8 0 4.2 0 5.27.545a5 5 0 0 1 2.185 2.185C22 6.8 22 8.2 22 11v2c0 2.8 0 4.2-.545 5.27a5 5 0 0 1-2.185 2.185C18.2 21 16.8 21 14 21h-4c-2.8 0-4.2 0-5.27-.545a5 5 0 0 1-2.185-2.185C2 17.2 2 15.8 2 13z" />
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 15a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5M9 12.188a15 15 0 0 0 2.556 2.655A.7.7 0 0 0 12 15m3-2.812a15 15 0 0 1-2.556 2.655A.7.7 0 0 1 12 15m0 0V4" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 15a3.72 3.72 0 0 0-1 2.58V21m5-6a3.72 3.72 0 0 1 1 2.58V21m-6-1.95a5.7 5.7 0 0 1-2.82.36c-1.52-.52-1.12-1.9-1.9-2.47A2.37 2.37 0 0 0 3 16.5m16-6.75c0 3-1.95 5.25-7 5.25s-7-2.25-7-5.25a6.3 6.3 0 0 1 .68-3c-.34-1.47-.21-3.28.52-3.64s2.27.3 3.54 1.15a13 13 0 0 1 2.26-.2 13 13 0 0 1 2.26.18c1.27-.85 2.88-1.48 3.54-1.15s.86 2.17.52 3.64A6.3 6.3 0 0 1 19 9.75Z" />
    </svg>
  );
}

function GumboWordmark() {
  return (
    <svg aria-label="Gumbo" role="img" viewBox="0 0 1023 200">
      <path d="M783.528 30.0439C789.299 30.0439 794.005 32.1296 797.689 36.3467C801.374 40.5636 803.193 45.7574 803.193 52.0605V75.2324C803.193 81.8909 801.462 87.0851 798 90.7695C794.538 94.4538 789.699 96.451 783.573 96.8506V98.8037C790.143 99.2033 795.292 101.29 799.109 105.107C802.927 108.925 804.791 114.296 804.791 121.221V148.521C804.791 154.957 802.971 160.24 799.287 164.457C795.603 168.674 790.898 170.761 785.127 170.761H633.046V30.0439H783.528ZM391.429 146.125C391.429 153.05 389.386 158.909 385.258 163.614C381.13 168.32 375.936 170.673 369.633 170.673H242.898L242.854 170.717C236.551 170.717 231.357 168.365 227.229 163.659C223.1 158.954 221.059 153.094 221.059 146.169V30.0439H289.642V120.023C289.642 125.794 291.418 129.922 294.969 132.408C298.52 134.894 303.27 136.137 309.307 136.137C315.344 136.137 320.049 134.938 323.467 132.497C326.885 130.1 328.572 125.972 328.572 120.201V30H391.429V146.125ZM185.459 30.0439C191.762 30.0439 196.957 32.3517 201.085 37.0127C205.213 41.6735 207.255 47.533 207.255 54.5908V79.1387H138.494V73.2354C138.494 68.7963 136.896 65.5557 133.7 63.6025C130.504 61.6494 126.065 60.6729 120.428 60.6729C114.79 60.6729 110.573 61.6494 107.377 63.6025C104.181 65.5557 102.583 68.7964 102.583 73.2354V127.479C102.583 131.918 104.225 135.159 107.51 137.112C110.795 139.065 115.235 140.042 120.872 140.042C126.509 140.042 130.682 139.065 133.834 137.112C136.985 135.159 138.539 131.918 138.539 127.479V119.401H114.169V88.1504H207.299V170.672H155.629V150.651H153.854C153.321 156.555 151.146 161.349 147.284 165.078C143.422 168.807 138.539 170.672 132.635 170.672H55.7959V170.716C49.4925 170.716 44.2982 168.364 40.1699 163.658C36.0417 158.953 34 153.093 34 146.168V54.5908C34.0001 47.533 36.0418 41.6735 40.1699 37.0127C44.2982 32.3517 49.4925 30.0439 55.7959 30.0439H185.459ZM516.344 73.0576H517.897L546.795 30.0439H616.932V170.716H549.947V111.188H548.394L505.956 170.716H499.653L457.216 110.967H455.44V170.716H406.3V30.0439H487.445L516.344 73.0576ZM966.861 30.0439C973.165 30.0439 978.359 32.3517 982.487 37.0127C986.615 41.6735 988.657 47.5331 988.657 54.5908V146.168C988.657 153.093 986.616 158.953 982.487 163.658C978.359 168.364 973.165 170.716 966.861 170.716H837.198C830.895 170.716 825.701 168.364 821.572 163.658C817.444 158.953 815.402 153.093 815.402 146.168V54.5908C815.402 47.533 817.444 41.6736 821.572 37.0127C825.701 32.3517 830.895 30.0439 837.198 30.0439H966.861ZM700.607 140.842H728.308C731.592 140.842 733.767 139.643 734.877 137.29C735.987 134.937 736.563 131.786 736.563 127.88C736.563 123.974 735.987 120.688 734.877 118.469C733.767 116.249 731.548 115.14 728.308 115.14H700.607V140.842ZM901.83 62.8926C896.193 62.8926 891.975 63.8246 888.779 65.7334C885.583 67.6422 883.985 70.8829 883.985 75.4551V125.172C883.985 129.744 885.628 133.028 888.912 134.981C892.193 136.932 896.624 137.908 902.251 137.911C907.745 137.909 912.044 136.977 915.191 135.07C918.343 133.162 919.896 129.921 919.896 125.35V75.6318C919.896 71.0599 918.298 67.7754 915.103 65.8223C911.906 63.8691 907.468 62.8926 901.83 62.8926ZM700.607 83.4893H727.73C730.616 83.4892 732.658 82.4239 733.9 80.249C735.143 78.0739 735.765 75.2324 735.765 71.7256C735.765 67.9084 735.143 65.0233 733.9 62.9814C732.658 60.9396 730.571 59.9181 727.73 59.918H700.607V83.4893Z" fill="currentColor" />
    </svg>
  );
}

function paintDitheredFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  pixelSize: number,
  contrast: number,
  threshold: number,
  accentColor: string,
  effect: DitherEffect,
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
  const accent = hexToRgb(accentColor);
  const luminanceMap = new Float32Array(sampleWidth * sampleHeight);
  const outputMap = new Uint8Array(sampleWidth * sampleHeight);

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const luminance =
        frame.data[index] * 0.2126 +
        frame.data[index + 1] * 0.7152 +
        frame.data[index + 2] * 0.0722;
      luminanceMap[y * sampleWidth + x] = Math.max(0, Math.min(255, (luminance - 128) * factor + 128));
    }
  }

  if (effect === "floyd") {
    const diffusion = new Float32Array(luminanceMap);
    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const position = y * sampleWidth + x;
        const value = diffusion[position] > threshold ? 255 : 0;
        const error = diffusion[position] - value;
        outputMap[position] = value;
        if (x + 1 < sampleWidth) diffusion[position + 1] += error * (7 / 16);
        if (y + 1 < sampleHeight) {
          if (x > 0) diffusion[position + sampleWidth - 1] += error * (3 / 16);
          diffusion[position + sampleWidth] += error * (5 / 16);
          if (x + 1 < sampleWidth) diffusion[position + sampleWidth + 1] += error * (1 / 16);
        }
      }
    }
  } else {
    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const position = y * sampleWidth + x;
        const orderedOffset = effect === "bayer" ? (BAYER_4X4[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 92 : 0;
        outputMap[position] = luminanceMap[position] > threshold + orderedOffset ? 255 : 0;
      }
    }
  }

  for (let position = 0; position < outputMap.length; position += 1) {
    const index = position * 4;
    const ink = outputMap[position] === 255;
    frame.data[index] = ink ? accent.r : 23;
    frame.data[index + 1] = ink ? accent.g : 26;
    frame.data[index + 2] = ink ? accent.b : 20;
    frame.data[index + 3] = 255;
    }

  outputContext.putImageData(frame, 0, 0);
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const captureRunRef = useRef(0);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [message, setMessage] = useState("Ready when you are");
  const [pixelSize, setPixelSize] = useState(6);
  const [contrast, setContrast] = useState(118);
  const [threshold, setThreshold] = useState(128);
  const [mirrored, setMirrored] = useState(true);
  const [accentColor, setAccentColor] = useState("#c8ff3d");
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownAction, setCountdownAction] = useState<"photo" | "gif" | null>(null);
  const [recordingRemaining, setRecordingRemaining] = useState<number | null>(null);
  const [isEncodingGif, setIsEncodingGif] = useState(false);
  const [captureInProgress, setCaptureInProgress] = useState<"photo" | "gif" | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [effect, setEffect] = useState<DitherEffect>("bayer");

  const stopCamera = useCallback(() => {
    captureRunRef.current += 1;
    setCountdown(null);
    setCountdownAction(null);
    setRecordingRemaining(null);
    setIsEncodingGif(false);
    setCaptureInProgress(null);
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
        paintDitheredFrame(video, canvas, scratch, pixelSize, contrast, threshold, accentColor, effect);
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [accentColor, cameraState, contrast, effect, pixelSize, threshold]);

  useEffect(() => () => {
    if (captureResult) URL.revokeObjectURL(captureResult.url);
  }, [captureResult]);

  const runCountdown = async (captureRun: number, action: "photo" | "gif") => {
    setCountdownAction(action);
    for (const count of [3, 2, 1]) {
      setCountdown(count);
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      if (captureRunRef.current !== captureRun) return false;
      if (!streamRef.current?.active) {
        setCountdown(null);
        setCountdownAction(null);
        return false;
      }
    }
    setCountdown(null);
    setCountdownAction(null);
    return true;
  };

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
      setControlsOpen(true);
      setMessage("Live · processed on this device");
    } catch {
      setCameraState("error");
      setMessage("Camera permission was not granted");
    }
  };

  const capturePhoto = async () => {
    const source = canvasRef.current;
    const video = videoRef.current;
    if (!source || !video || cameraState !== "live" || countdown !== null || recordingRemaining !== null || isEncodingGif) return;

    const captureRun = ++captureRunRef.current;
    const controlsWereOpen = controlsOpen;
    setControlsOpen(false);
    setCaptureInProgress("photo");
    try {
      if (!await runCountdown(captureRun, "photo")) return;

      const output = document.createElement("canvas");
      output.width = video.videoWidth;
      output.height = video.videoHeight;
      const context = output.getContext("2d");
      if (!context) return;

      context.imageSmoothingEnabled = false;
      if (mirrored) {
        context.translate(output.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(source, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
      if (!blob || captureRunRef.current !== captureRun) return;
      setCaptureResult((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url: URL.createObjectURL(blob), kind: "photo", size: blob.size, filename: `dither-me-${Date.now()}.png` };
      });
    } finally {
      if (captureRunRef.current === captureRun) {
        setCaptureInProgress(null);
        if (controlsWereOpen) setControlsOpen(true);
      }
    }
  };

  const captureGif = async () => {
    const source = canvasRef.current;
    if (!source || !source.width || !source.height || cameraState !== "live" || countdown !== null || recordingRemaining !== null || isEncodingGif) return;

    const captureRun = ++captureRunRef.current;
    const controlsWereOpen = controlsOpen;
    let failed = false;
    setControlsOpen(false);
    setCaptureInProgress("gif");
    try {
      const encoderModule = import("gifenc");
      if (!await runCountdown(captureRun, "gif")) return;
      const { GIFEncoder, applyPalette } = await encoderModule;

      const outputWidth = 320;
      const outputHeight = Math.max(1, Math.round(source.height * (outputWidth / source.width)));
      const output = document.createElement("canvas");
      output.width = outputWidth;
      output.height = outputHeight;
      const context = output.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      const accent = hexToRgb(accentColor);
      const palette = [[23, 26, 20], [accent.r, accent.g, accent.b]];
      const gif = GIFEncoder();
      const totalFrames = GIF_DURATION_SECONDS * GIF_FRAMES_PER_SECOND;
      const frameDelay = 1000 / GIF_FRAMES_PER_SECOND;
      const startedAt = performance.now();

      setRecordingRemaining(GIF_DURATION_SECONDS);
      setMessage("Recording GIF · no audio");

      for (let frame = 0; frame < totalFrames; frame += 1) {
        if (captureRunRef.current !== captureRun || !streamRef.current?.active) return;

        context.save();
        context.imageSmoothingEnabled = false;
        if (mirrored) {
          context.translate(outputWidth, 0);
          context.scale(-1, 1);
        }
        context.drawImage(source, 0, 0, outputWidth, outputHeight);
        context.restore();

        const rgba = context.getImageData(0, 0, outputWidth, outputHeight).data;
        const indexedFrame = applyPalette(rgba, palette);
        gif.writeFrame(indexedFrame, outputWidth, outputHeight, {
          palette: frame === 0 ? palette : undefined,
          delay: frameDelay,
          repeat: 0,
        });

        setRecordingRemaining(Math.max(1, Math.ceil((totalFrames - frame - 1) / GIF_FRAMES_PER_SECOND)));
        const wait = Math.max(0, startedAt + (frame + 1) * frameDelay - performance.now());
        await new Promise((resolve) => window.setTimeout(resolve, wait));
      }

      if (captureRunRef.current !== captureRun) return;
      setRecordingRemaining(null);
      setIsEncodingGif(true);
      setMessage("Finishing GIF…");
      gif.finish();
      const gifBytes = gif.bytes();
      const gifBuffer = new ArrayBuffer(gifBytes.byteLength);
      new Uint8Array(gifBuffer).set(gifBytes);
      const blob = new Blob([gifBuffer], { type: "image/gif" });
      setCaptureResult((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url: URL.createObjectURL(blob), kind: "gif", size: blob.size, filename: `dither-me-${Date.now()}.gif` };
      });
    } catch {
      failed = true;
      setMessage("GIF capture could not be completed");
    } finally {
      if (captureRunRef.current === captureRun) {
        setCountdown(null);
        setCountdownAction(null);
        setRecordingRemaining(null);
        setIsEncodingGif(false);
        setCaptureInProgress(null);
        if (controlsWereOpen) setControlsOpen(true);
        if (!failed && streamRef.current?.active) setMessage("Live · processed on this device");
      }
    }
  };

  const captureBusy = captureInProgress !== null || countdown !== null || recordingRemaining !== null || isEncodingGif;

  return (
    <main className="app-shell" style={{ "--acid": accentColor } as CSSProperties}>
      <header className="masthead">
        <div className="brand-lockup">
          <a className="wordmark" href="#top" aria-label="Dither me home">dither me<span aria-hidden="true">.</span></a>
          <a className="gumbo-by" href={GUMBO_URL} target="_blank" rel="noreferrer" aria-label="Dither me by Gumbo">by <GumboWordmark /></a>
        </div>
        <a className="github-link" href="https://github.com/hellogumbo/ditherme" target="_blank" rel="noreferrer" aria-label="View dither me on GitHub">
          <GitHubIcon />
        </a>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">Turn your camera into one-bit moving type.</p>
        <h1>Your face, <span>reduced beautifully.</span></h1>
        <p className="lede">A tiny live studio that redraws every frame with your choice of pixel dither. Nothing leaves your device.</p>
      </section>

      <section className="studio" aria-label="Camera dither studio">
        <div className={`camera-card${mirrored ? " is-mirrored" : ""}`}>
          <video ref={videoRef} className="source-video" muted playsInline aria-hidden="true" />
          <canvas ref={canvasRef} className="dither-canvas" aria-label="Live dithered camera preview" />
          <canvas ref={scratchRef} className="scratch-canvas" aria-hidden="true" />
          {countdown !== null && (
            <div className="capture-countdown" role="status" aria-live="assertive" aria-label={`${countdownAction === "gif" ? "Recording GIF" : "Taking photo"} in ${countdown}`}>
              <span key={countdown}>{countdown}</span>
            </div>
          )}
          {recordingRemaining !== null && (
            <div className="recording-status" role="status" aria-live="polite"><i /> GIF · {recordingRemaining}s</div>
          )}
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
            <span>{EFFECTS.find((item) => item.id === effect)?.label} / LIVE</span>
          </div>
          <div className="live-chip">
            <i className={cameraState === "live" ? "active" : ""} />
            {message}
          </div>

          {cameraState !== "live" && (
            <div className="camera-gate">
              <button className="camera-button stage-camera-button" type="button" onClick={startCamera} disabled={cameraState === "requesting"}>
                <CameraIcon />
                <span>{cameraState === "requesting" ? "Starting…" : "Start camera"}</span>
              </button>
              <p>Private, live, and processed on this device.</p>
            </div>
          )}

          {!captureBusy && <aside className={`control-card overlay-controls${controlsOpen ? " is-open" : " is-closed"}`} aria-label="Camera and dither controls">
            <div className="control-heading">
              <span>Controls</span>
              <button type="button" onClick={() => setControlsOpen((open) => !open)} aria-expanded={controlsOpen}>
                {controlsOpen ? "Minimize" : "Open controls"}
              </button>
            </div>

            {controlsOpen && (
              <div className="control-body">
                {cameraState === "live" && (
                  <button className="camera-button panel-camera-button" type="button" onClick={stopCamera}>
                    <span>Stop camera</span>
                  </button>
                )}

                <fieldset className="panel-fields" disabled={captureBusy}>
                  <fieldset className="effect-control">
                    <legend>Effect</legend>
                    <div className="effect-options">
                      {EFFECTS.map((item) => (
                        <button key={item.id} type="button" className={effect === item.id ? "selected" : ""} aria-pressed={effect === item.id} onClick={() => setEffect(item.id)}>
                          <strong>{item.label}</strong>
                          <span>{item.detail}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

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

                  <div className="color-control">
                    <div className="control-label"><span>Ink color</span><output>{accentColor.toUpperCase()}</output></div>
                    <label className="color-well">
                      <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} aria-label="Choose dither color" />
                      <span style={{ backgroundColor: accentColor }} aria-hidden="true" />
                      <b>Pick a color</b>
                    </label>
                    <div className="swatches" aria-label="Color presets">
                      {COLOR_PRESETS.map((color) => (
                        <button key={color} type="button" className={color === accentColor ? "selected" : ""} style={{ backgroundColor: color }} aria-label={`Use ${color}`} aria-pressed={color === accentColor} onClick={() => setAccentColor(color)} />
                      ))}
                    </div>
                  </div>
                </fieldset>

                <div className="panel-actions">
                  <div className="capture-control">
                    {captureResult ? (
                      <div className="capture-result">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={captureResult.url} alt={`Your captured dithered ${captureResult.kind === "gif" ? "animation" : "photo"}`} />
                        <p className="capture-meta">{captureResult.kind === "gif" ? "5 second GIF" : "PNG photo"} · {Math.max(1, Math.round(captureResult.size / 1024))} KB</p>
                        <a className="download-button" href={captureResult.url} download={captureResult.filename}><span><DownloadIcon /> Download {captureResult.kind === "gif" ? "GIF" : "image"}</span></a>
                        <button className="retake-button" type="button" onClick={() => setCaptureResult(null)}>New capture</button>
                      </div>
                    ) : (
                      <div className="capture-buttons">
                        <button className="capture-button" type="button" onClick={capturePhoto} disabled={cameraState !== "live" || captureBusy}><CameraIcon /> Capture photo</button>
                        <button className="capture-button gif-button" type="button" onClick={captureGif} disabled={cameraState !== "live" || captureBusy}><i aria-hidden="true" /> {recordingRemaining !== null ? `Recording ${recordingRemaining}s` : isEncodingGif ? "Finishing…" : "Make 5s GIF"}</button>
                      </div>
                    )}
                  </div>
                  <p className="privacy">Private by default. Nothing leaves this device.</p>
                </div>
              </div>
            )}
          </aside>}
        </div>
      </section>

      <footer>
        <div className="footer-credits">
          <p>An open source project by <a href={GUMBO_URL} target="_blank" rel="noreferrer">Gumbo</a>.</p>
          <p>Built with <a href="https://canvasui.dev/docs/components/dithered-object" target="_blank" rel="noreferrer">Canvas UI Dithered Object</a>.</p>
        </div>
        <div className="pixel-row" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      </footer>
    </main>
  );
}
