"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

type CameraState = "idle" | "requesting" | "live" | "error";

const COLOR_PRESETS = ["#c8ff3d", "#2563eb", "#d65c73", "#6a9d62", "#f97316"];

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
      frame.data[index] = ink ? accent.r : 23;
      frame.data[index + 1] = ink ? accent.g : 26;
      frame.data[index + 2] = ink ? accent.b : 20;
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
  const [accentColor, setAccentColor] = useState("#c8ff3d");
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);

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
        paintDitheredFrame(video, canvas, scratch, pixelSize, contrast, threshold, accentColor);
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [accentColor, cameraState, contrast, pixelSize, threshold]);

  useEffect(() => () => {
    if (captureUrl) URL.revokeObjectURL(captureUrl);
  }, [captureUrl]);

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

  const capturePhoto = () => {
    const source = canvasRef.current;
    const video = videoRef.current;
    if (!source || !video || cameraState !== "live") return;

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
    output.toBlob((blob) => {
      if (!blob) return;
      setCaptureUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    }, "image/png");
  };

  return (
    <main className="app-shell" style={{ "--acid": accentColor } as CSSProperties}>
      <header className="masthead">
        <div className="brand-lockup">
          <a className="wordmark" href="#top" aria-label="Dither me home">dither me<span aria-hidden="true">.</span></a>
          <span className="gumbo-by">by <GumboWordmark /></span>
        </div>
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
            <strong>01—05</strong>
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

        <aside className="control-card creative-card" aria-label="Color and export controls">
          <div className="control-heading">
            <span>Make it yours</span>
            <strong>06—07</strong>
          </div>

          <div className="color-control">
            <div className="control-label"><span>Ink color</span><output>{accentColor.toUpperCase()}</output></div>
            <label className="color-well">
              <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} aria-label="Choose dither color" />
              <span style={{ backgroundColor: accentColor }} aria-hidden="true" />
              <b>Pick a color</b>
            </label>
            <div className="swatches" aria-label="Color presets">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={color === accentColor ? "selected" : ""}
                  style={{ backgroundColor: color }}
                  aria-label={`Use ${color}`}
                  aria-pressed={color === accentColor}
                  onClick={() => setAccentColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="capture-control">
            <div className="control-label"><span>Still frame</span><output>PNG</output></div>
            {captureUrl ? (
              <div className="capture-result">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captureUrl} alt="Your captured dithered photo" />
                <a className="download-button" href={captureUrl} download={`dither-me-${Date.now()}.png`}>
                  <span><DownloadIcon /> Download image</span>
                </a>
                <button className="retake-button" type="button" onClick={capturePhoto}>Capture another</button>
              </div>
            ) : (
              <>
                <div className="capture-empty"><CameraIcon /><p>Your processed frame will appear here.</p></div>
                <button className="capture-button" type="button" onClick={capturePhoto} disabled={cameraState !== "live"}>
                  <CameraIcon /> Capture photo
                </button>
              </>
            )}
          </div>
        </aside>
      </section>

      <footer>
        <p>Made for faces, gestures, and happy accidents.</p>
        <div className="pixel-row" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      </footer>
    </main>
  );
}
