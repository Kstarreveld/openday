const analysisTab = document.getElementById("analysis-tab");
const compareTab = document.getElementById("compare-tab");
const analysisPanel = document.getElementById("analysis-panel");
const comparePanel = document.getElementById("compare-panel");

const analysisFileInput = document.getElementById("analysis-file");
const analysisDrop = document.getElementById("analysis-drop");
const analysisPreview = document.getElementById("analysis-preview");
const analysisVisual = document.getElementById("analysis-visual");
const analysisCanvas = document.getElementById("analysis-canvas");
const analysisContext = analysisCanvas.getContext("2d");
const analyzeButton = document.getElementById("analyze-button");
const analysisResults = document.getElementById("analysis-results");
const analysisError = document.getElementById("analysis-error");
const uploadSourceButton = document.getElementById("upload-source-button");
const cameraSourceButton = document.getElementById("camera-source-button");
const uploadSourcePanel = document.getElementById("upload-source-panel");
const cameraSourcePanel = document.getElementById("camera-source-panel");
const cameraStage = document.getElementById("camera-stage");
const cameraVideo = document.getElementById("camera-video");
const cameraPlaceholder = cameraStage.querySelector(".camera-placeholder");
const startCameraButton = document.getElementById("start-camera-button");
const capturePhotoButton = document.getElementById("capture-photo-button");
const cameraStatus = document.getElementById("camera-status");

const firstFileInput = document.getElementById("first-file");
const secondFileInput = document.getElementById("second-file");
const firstDrop = document.getElementById("first-drop");
const secondDrop = document.getElementById("second-drop");
const firstPreview = document.getElementById("first-preview");
const secondPreview = document.getElementById("second-preview");
const compareButton = document.getElementById("compare-button");
const compareResults = document.getElementById("compare-results");
const compareError = document.getElementById("compare-error");

let analysisFile = null;
let uploadedAnalysisFile = null;
let capturedAnalysisFile = null;
let firstFile = null;
let secondFile = null;
let cameraStream = null;
let cameraRequestId = 0;
const previewUrls = new Map();

function selectMode(tab) {
  const showAnalysis = tab === analysisTab;
  if (!showAnalysis) stopCamera();
  analysisTab.classList.toggle("is-active", showAnalysis);
  compareTab.classList.toggle("is-active", !showAnalysis);
  analysisTab.setAttribute("aria-selected", String(showAnalysis));
  compareTab.setAttribute("aria-selected", String(!showAnalysis));
  analysisTab.tabIndex = showAnalysis ? 0 : -1;
  compareTab.tabIndex = showAnalysis ? -1 : 0;
  analysisPanel.hidden = !showAnalysis;
  comparePanel.hidden = showAnalysis;
}

function selectAnalysisSource(source) {
  const useCamera = source === "camera";
  uploadSourceButton.classList.toggle("is-active", !useCamera);
  cameraSourceButton.classList.toggle("is-active", useCamera);
  uploadSourceButton.setAttribute("aria-pressed", String(!useCamera));
  cameraSourceButton.setAttribute("aria-pressed", String(useCamera));
  uploadSourcePanel.hidden = useCamera;
  cameraSourcePanel.hidden = !useCamera;
  if (!useCamera) stopCamera();

  analysisFile = useCamera ? capturedAnalysisFile : uploadedAnalysisFile;
  analyzeButton.disabled = !analysisFile;
  if (analysisFile) {
    setPreview(analysisPreview, analysisDrop, analysisFile);
    analysisVisual.classList.remove("is-empty");
  } else {
    analysisVisual.classList.add("is-empty");
  }
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.setAttribute("aria-busy", String(loading));
}

function setPreview(image, zone, file) {
  const oldUrl = previewUrls.get(image);
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  const url = URL.createObjectURL(file);
  previewUrls.set(image, url);
  image.src = url;
  zone.classList.add("has-file");
}

function setAnalysisFile(file, source) {
  analysisFile = file;
  if (source === "camera") {
    capturedAnalysisFile = file;
  } else {
    uploadedAnalysisFile = file;
  }
  setPreview(analysisPreview, analysisDrop, file);
  analysisVisual.classList.remove("is-empty");
  analysisCanvas.width = 0;
  analysisCanvas.height = 0;
  analyzeButton.disabled = false;

  if (source === "upload") {
    analysisDrop.querySelector("strong").textContent = file.name;
  }
}

function stopCamera() {
  cameraRequestId += 1;
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraStage.classList.add("is-idle");
  capturePhotoButton.hidden = true;
  startCameraButton.hidden = false;
}

async function startCamera() {
  stopCamera();
  const requestId = cameraRequestId;
  cameraPlaceholder.textContent = "Opening the webcam…";
  cameraStatus.textContent = "Requesting camera access…";
  startCameraButton.disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (requestId !== cameraRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    cameraStage.classList.remove("is-idle");
    startCameraButton.hidden = true;
    capturePhotoButton.hidden = false;
    cameraStatus.textContent = "Center your face, then take the photo.";
  } catch (error) {
    stopCamera();
    cameraPlaceholder.textContent = "The webcam could not be opened.";
    cameraStatus.textContent = error.name === "NotAllowedError"
      ? "Camera permission was denied. Allow access in the browser and try again."
      : "No available webcam was found.";
  } finally {
    startCameraButton.disabled = false;
  }
}

async function capturePhoto() {
  if (!cameraStream || !cameraVideo.videoWidth) return;

  const photoCanvas = document.createElement("canvas");
  photoCanvas.width = cameraVideo.videoWidth;
  photoCanvas.height = cameraVideo.videoHeight;
  const photoContext = photoCanvas.getContext("2d");
  photoContext.translate(photoCanvas.width, 0);
  photoContext.scale(-1, 1);
  photoContext.drawImage(cameraVideo, 0, 0, photoCanvas.width, photoCanvas.height);

  const blob = await new Promise((resolve) => photoCanvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) {
    cameraStatus.textContent = "The photo could not be captured. Please try again.";
    return;
  }

  const photo = new File([blob], `webcam-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  setAnalysisFile(photo, "camera");
  stopCamera();
  cameraPlaceholder.textContent = "Photo captured. Use Retake if you want another.";
  cameraStatus.textContent = "Photo ready for analysis.";
  startCameraButton.textContent = "Retake photo";
}

function isImage(file) {
  return file && file.type.startsWith("image/");
}

function bindDropZone(zone, input, onFile) {
  input.addEventListener("change", () => {
    const [file] = input.files;
    if (isImage(file)) onFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragging");
    });
  });

  zone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (isImage(file)) onFile(file);
  });
}

function formatLabel(value) {
  return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatValue(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
}

function dominantValue(values) {
  const entries = Object.entries(values || {}).filter(([, value]) => typeof value === "number");
  if (!entries.length) return "—";
  return entries.reduce((best, item) => item[1] > best[1] ? item : best)[0];
}

function landmarkPoints(value, points = []) {
  if (!value || typeof value !== "object") return points;
  if (Number.isFinite(value.x) && Number.isFinite(value.y)) {
    points.push(value);
    return points;
  }
  Object.values(value).forEach((child) => landmarkPoints(child, points));
  return points;
}

function drawFaces(faces) {
  if (!analysisPreview.naturalWidth) {
    analysisPreview.addEventListener("load", () => drawFaces(faces), { once: true });
    return;
  }
  analysisCanvas.width = analysisPreview.naturalWidth;
  analysisCanvas.height = analysisPreview.naturalHeight;
  analysisContext.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);

  faces.forEach((face, index) => {
    const color = `hsl(${(72 + index * 83) % 360} 78% 58%)`;
    const rectangle = face.face_rectangle;
    if (rectangle) {
      analysisContext.strokeStyle = color;
      analysisContext.lineWidth = Math.max(2, analysisCanvas.width / 350);
      analysisContext.strokeRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
      analysisContext.fillStyle = color;
      analysisContext.font = `bold ${Math.max(13, analysisCanvas.width / 42)}px Segoe UI`;
      analysisContext.fillText(`Face ${index + 1}`, rectangle.left + 5, Math.max(20, rectangle.top - 8));
    }

    analysisContext.fillStyle = color;
    landmarkPoints(face.landmark).forEach(({ x, y }) => {
      analysisContext.beginPath();
      analysisContext.arc(x, y, Math.max(2, analysisCanvas.width / 450), 0, Math.PI * 2);
      analysisContext.fill();
    });
  });
}

function valueRow(label, value) {
  const row = document.createElement("div");
  row.className = "detail-row";
  const name = document.createElement("span");
  name.textContent = formatLabel(label);
  const result = document.createElement("strong");
  result.textContent = formatValue(value);
  row.append(name, result);
  return row;
}

function appendObjectRows(container, value, prefix = "") {
  Object.entries(value || {}).forEach(([key, child]) => {
    const label = prefix ? `${prefix} · ${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      appendObjectRows(container, child, label);
    } else {
      container.appendChild(valueRow(label, child));
    }
  });
}

function detailCard(title, value) {
  const card = document.createElement("section");
  card.className = "detail-card";
  const heading = document.createElement("h4");
  heading.textContent = formatLabel(title);
  card.appendChild(heading);
  appendObjectRows(card, value);
  return card;
}

function highlight(label, value) {
  const item = document.createElement("div");
  item.className = "highlight";
  const name = document.createElement("small");
  name.textContent = label;
  const result = document.createElement("strong");
  result.textContent = formatValue(value);
  item.append(name, result);
  return item;
}

function renderAnalysis(data) {
  const faces = Array.isArray(data.faces) ? data.faces : [];
  analysisResults.replaceChildren();
  drawFaces(faces);

  if (!faces.length) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "No face was detected in this image.";
    analysisResults.appendChild(empty);
    return;
  }

  faces.forEach((face, index) => {
    const attributes = face.attributes || {};
    const result = document.createElement("article");
    result.className = "face-result";

    const heading = document.createElement("div");
    heading.className = "face-title";
    const title = document.createElement("h3");
    title.textContent = `Face ${index + 1}`;
    const count = document.createElement("span");
    count.textContent = `${landmarkPoints(face.landmark).length} landmark points`;
    heading.append(title, count);

    const highlights = document.createElement("div");
    highlights.className = "highlights";
    highlights.append(
      highlight("Age", attributes.age?.value),
      highlight("Gender", attributes.gender?.value),
      highlight("Emotion", dominantValue(attributes.emotion)),
      highlight("Smile", attributes.smile?.value ?? attributes.smiling?.value),
      highlight("Quality", attributes.facequality?.value)
    );

    const details = document.createElement("div");
    details.className = "detail-grid";
    Object.entries(attributes).filter(([key]) => key !== "ethnicity").forEach(([key, value]) => {
      if (value && typeof value === "object") details.appendChild(detailCard(key, value));
    });

    result.append(heading, highlights, details);
    analysisResults.appendChild(result);
  });
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("The API route is unavailable. Restart the Node server and try again.");
    }
    throw new Error(data.error || `The Face++ request failed (HTTP ${response.status}).`);
  }
  return data;
}

async function analyzePortrait() {
  if (!analysisFile) return;
  setLoading(analyzeButton, true);
  analysisError.textContent = "";

  const formData = new FormData();
  formData.append("image_file", analysisFile);

  try {
    const response = await fetch("/analyze-face", { method: "POST", body: formData });
    renderAnalysis(await parseResponse(response));
  } catch (error) {
    analysisError.textContent = error.message;
  } finally {
    setLoading(analyzeButton, false);
  }
}

function findThreshold(thresholds, exponent) {
  const key = Object.keys(thresholds || {}).find((item) => item.replace("-", "") === `1e${exponent}`.replace("-", ""));
  return key ? thresholds[key] : null;
}

function comparisonVerdict(confidence, thresholds) {
  const values = Object.values(thresholds || {}).filter(Number.isFinite).sort((a, b) => a - b);
  const loose = findThreshold(thresholds, "-3") ?? values[0] ?? 60;
  const strict = findThreshold(thresholds, "-5") ?? values[values.length - 1] ?? 80;
  if (confidence >= strict) return ["Very strong match", "The score clears the strictest returned comparison threshold."];
  if (confidence >= loose) return ["Likely match", "The score clears a returned comparison threshold, but not the strictest one."];
  return ["Unlikely match", "The score is below the returned comparison thresholds."];
}

function renderComparison(data) {
  compareResults.replaceChildren();
  const firstFaces = Array.isArray(data.faces1) ? data.faces1 : [];
  const secondFaces = Array.isArray(data.faces2) ? data.faces2 : [];
  if (!firstFaces.length || !secondFaces.length) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    if (!firstFaces.length && !secondFaces.length) {
      empty.textContent = "No face was detected in either portrait.";
    } else {
      empty.textContent = `No face was detected in portrait ${firstFaces.length ? "B" : "A"}.`;
    }
    compareResults.appendChild(empty);
    return;
  }

  const confidence = Number(data.confidence || 0);
  const [verdict, explanation] = comparisonVerdict(confidence, data.thresholds);

  const layout = document.createElement("div");
  layout.className = "score-layout";
  const ring = document.createElement("div");
  ring.className = "score-ring";
  ring.style.setProperty("--score", Math.max(0, Math.min(100, confidence)));
  const score = document.createElement("span");
  score.className = "score-value";
  score.textContent = confidence.toFixed(1);
  ring.appendChild(score);

  const copy = document.createElement("div");
  copy.className = "score-copy";
  const title = document.createElement("h3");
  title.textContent = verdict;
  const description = document.createElement("p");
  description.textContent = explanation;
  const thresholds = document.createElement("div");
  thresholds.className = "thresholds";

  Object.entries(data.thresholds || {}).sort((a, b) => a[1] - b[1]).forEach(([rate, value]) => {
    const row = document.createElement("div");
    row.className = "threshold-row";
    const label = document.createElement("span");
    label.textContent = `FMR ${rate}`;
    const track = document.createElement("span");
    track.className = "threshold-track";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    track.appendChild(fill);
    const number = document.createElement("strong");
    number.textContent = Number(value).toFixed(1);
    row.append(label, track, number);
    thresholds.appendChild(row);
  });

  copy.append(title, description, thresholds);
  layout.append(ring, copy);
  compareResults.appendChild(layout);
}

async function compareFaces() {
  if (!firstFile || !secondFile) return;
  setLoading(compareButton, true);
  compareError.textContent = "";

  const formData = new FormData();
  formData.append("image_file1", firstFile);
  formData.append("image_file2", secondFile);

  try {
    const response = await fetch("/compare-faces", { method: "POST", body: formData });
    renderComparison(await parseResponse(response));
  } catch (error) {
    compareError.textContent = error.message;
  } finally {
    setLoading(compareButton, false);
  }
}

analysisTab.addEventListener("click", () => selectMode(analysisTab));
compareTab.addEventListener("click", () => selectMode(compareTab));
[analysisTab, compareTab].forEach((tab) => {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const next = tab === analysisTab ? compareTab : analysisTab;
    selectMode(next);
    next.focus();
  });
});

bindDropZone(analysisDrop, analysisFileInput, (file) => {
  setAnalysisFile(file, "upload");
});

bindDropZone(firstDrop, firstFileInput, (file) => {
  firstFile = file;
  setPreview(firstPreview, firstDrop, file);
  compareButton.disabled = !(firstFile && secondFile);
});

bindDropZone(secondDrop, secondFileInput, (file) => {
  secondFile = file;
  setPreview(secondPreview, secondDrop, file);
  compareButton.disabled = !(firstFile && secondFile);
});

analyzeButton.addEventListener("click", analyzePortrait);
compareButton.addEventListener("click", compareFaces);
uploadSourceButton.addEventListener("click", () => selectAnalysisSource("upload"));
cameraSourceButton.addEventListener("click", () => selectAnalysisSource("camera"));
startCameraButton.addEventListener("click", startCamera);
capturePhotoButton.addEventListener("click", capturePhoto);
window.addEventListener("pagehide", stopCamera);
