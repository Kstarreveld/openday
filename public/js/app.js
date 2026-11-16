const CAPTURE_INTERVAL_MS = 3000;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle-capture");
const statusChip = document.getElementById("status-chip");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const analysisPlaceholder = document.getElementById("analysis-placeholder");
const errorEl = document.getElementById("error");
const metricEls = {
  gender: document.getElementById("metric-gender"),
  age: document.getElementById("metric-age"),
  emotion: document.getElementById("metric-emotion"),
};
const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'));
const tabViews = Array.from(document.querySelectorAll('[role="tabpanel"]'));
const faceCountBadge = document.getElementById("face-count-badge");
const outputSummary = document.getElementById("output-summary");
const outputTime = document.getElementById("output-time");
const responseMeta = document.getElementById("response-meta");
const facesOutput = document.getElementById("faces-output");
const rawResponse = document.getElementById("raw-response");
const rawJson = document.getElementById("raw-json");

let captureTimer = null;
let isBusy = false;

function setStatus(label, className) {
  statusChip.textContent = label;
  statusChip.className = `status-chip ${className || ""}`.trim();
}

function setError(message) {
  errorEl.textContent = message || "";
}

function setMetrics({ gender = "—", age = "—", emotion = "—" } = {}) {
  metricEls.gender.textContent = gender;
  metricEls.age.textContent = age;
  metricEls.emotion.textContent = emotion;
}

function isCapturing() {
  return captureTimer !== null;
}

async function startCapture() {
  setError("");
  toggleButton.disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    video.srcObject = stream;
    cameraPlaceholder.hidden = true;
    captureTimer = setInterval(captureAndSendImage, CAPTURE_INTERVAL_MS);
    toggleButton.textContent = "Stop camera";
    toggleButton.classList.add("is-stop");
    setStatus("Live", "is-live");
    captureAndSendImage();
  } catch (error) {
    console.error("Error accessing webcam:", error);
    setError("Camera access was blocked or unavailable.");
    setStatus("Idle");
  } finally {
    toggleButton.disabled = false;
  }
}

function stopCapture() {
  clearInterval(captureTimer);
  captureTimer = null;

  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  cameraPlaceholder.hidden = false;
  analysisPlaceholder.hidden = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  toggleButton.textContent = "Start camera";
  toggleButton.classList.remove("is-stop");
  setStatus("Idle");
}

function toggleCapture() {
  if (isCapturing()) {
    stopCapture();
    return;
  }
  startCapture();
}

function captureAndSendImage() {
  if (!isCapturing() || isBusy || !video.videoWidth) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (blob) analyzeFace(blob);
  }, "image/jpeg", 0.85);
}

async function analyzeFace(blob) {
  isBusy = true;
  setStatus("Analyzing", "is-busy");

  const formData = new FormData();
  formData.append("image_file", blob, "frame.jpg");

  try {
    const response = await fetch("/analyze-face", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Face analysis failed (HTTP ${response.status}).`);
    }
    if (!data) throw new Error("The server returned an invalid response. Try again.");
    displayResult(data);
    setError("");
  } catch (error) {
    console.error("Error:", error);
    setError(error.message || "Could not analyze this frame.");
  } finally {
    isBusy = false;
    if (isCapturing()) setStatus("Live", "is-live");
  }
}

function displayResult(data) {
  const faces = Array.isArray(data.faces) ? data.faces : [];
  renderOutput(data, faces);

  if (!faces.length) {
    analysisPlaceholder.hidden = false;
    setMetrics({ emotion: "No face detected" });
    return;
  }

  const attributes = faces[0].attributes || {};
  setMetrics({
    gender: attributes.gender?.value || "—",
    age: attributes.age?.value ?? "—",
    emotion: attributes.emotion ? getDominantEmotion(attributes.emotion) : "—",
  });

  analysisPlaceholder.hidden = true;
  drawDetections(faces);
}

function getDominantEmotion(emotions) {
  const entries = Object.entries(emotions);
  if (!entries.length) return "—";
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

function collectPoints(value, path = "", points = []) {
  if (!value || typeof value !== "object") return points;

  if (Number.isFinite(value.x) && Number.isFinite(value.y)) {
    points.push({ x: value.x, y: value.y, name: path });
    return points;
  }

  Object.entries(value).forEach(([key, child]) => {
    collectPoints(child, path ? `${path}.${key}` : key, points);
  });
  return points;
}

function drawDetections(faces) {
  faces.forEach((face, faceIndex) => {
    const hue = (72 + faceIndex * 83) % 360;
    const color = `hsl(${hue} 75% 60%)`;
    const rectangle = face.face_rectangle;

    if (rectangle) {
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.strokeRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
      context.fillStyle = color;
      context.font = "bold 14px Segoe UI, sans-serif";
      context.fillText(`Face ${faceIndex + 1}`, rectangle.left + 5, Math.max(16, rectangle.top - 6));
    }

    context.fillStyle = color;
    context.strokeStyle = "rgba(12, 18, 32, 0.8)";
    context.lineWidth = 1;
    collectPoints(face.landmark).forEach(({ x, y }) => {
      context.beginPath();
      context.arc(x, y, 3, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    });
  });
}

function selectTab(tabId) {
  tabButtons.forEach((button) => {
    const selected = button.id === tabId;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  tabViews.forEach((view) => {
    view.hidden = view.getAttribute("aria-labelledby") !== tabId;
  });
}

function humanize(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
}

function createValueRow(label, value) {
  const row = document.createElement("div");
  row.className = "data-row";
  const name = document.createElement("span");
  name.textContent = humanize(label);
  const result = document.createElement("strong");
  result.textContent = formatValue(value);
  row.append(name, result);
  return row;
}

function appendAttribute(container, key, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const group = document.createElement("section");
    group.className = "attribute-group";
    const heading = document.createElement("h4");
    heading.textContent = humanize(key);
    group.appendChild(heading);
    Object.entries(value).forEach(([childKey, childValue]) => {
      if (childValue && typeof childValue === "object") {
        appendAttribute(group, childKey, childValue);
      } else {
        group.appendChild(createValueRow(childKey, childValue));
      }
    });
    container.appendChild(group);
    return;
  }
  container.appendChild(createValueRow(key, value));
}

function renderOutput(data, faces) {
  const faceLabel = `${faces.length} ${faces.length === 1 ? "face" : "faces"}`;
  outputSummary.textContent = `${faceLabel} detected. Every returned attribute and coordinate is included below.`;
  outputTime.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
  faceCountBadge.textContent = faces.length;
  faceCountBadge.hidden = false;

  responseMeta.replaceChildren();
  [
    ["Faces", faces.length],
    ["Time used", data.time_used == null ? "—" : `${data.time_used} ms`],
    ["Image ID", data.image_id || "—"],
    ["Request ID", data.request_id || "—"],
  ].forEach(([label, value]) => responseMeta.appendChild(createValueRow(label, value)));
  responseMeta.hidden = false;

  facesOutput.replaceChildren();
  if (!faces.length) {
    const empty = document.createElement("div");
    empty.className = "empty-output";
    const title = document.createElement("strong");
    title.textContent = "No face detected";
    const help = document.createElement("span");
    help.textContent = "Try facing the camera directly in brighter, even lighting.";
    empty.append(title, help);
    facesOutput.appendChild(empty);
  }

  faces.forEach((face, index) => {
    const card = document.createElement("article");
    card.className = "face-card";

    const header = document.createElement("div");
    header.className = "face-card-head";
    const title = document.createElement("h3");
    title.textContent = `Face ${index + 1}`;
    const landmarkCount = document.createElement("span");
    landmarkCount.className = "landmark-count";
    landmarkCount.textContent = `${collectPoints(face.landmark).length} landmarks`;
    header.append(title, landmarkCount);
    card.appendChild(header);

    const identity = document.createElement("div");
    identity.className = "face-identity";
    identity.appendChild(createValueRow("Face token", face.face_token || "—"));
    Object.entries(face.face_rectangle || {}).forEach(([key, value]) => {
      identity.appendChild(createValueRow(key, value));
    });
    card.appendChild(identity);

    const attributes = document.createElement("div");
    attributes.className = "attributes-grid";
    Object.entries(face.attributes || {})
      .filter(([key]) => key !== "ethnicity")
      .forEach(([key, value]) => appendAttribute(attributes, key, value));
    card.appendChild(attributes);
    facesOutput.appendChild(card);
  });

  rawJson.textContent = JSON.stringify(data, null, 2);
  rawResponse.hidden = false;
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => selectTab(button.id));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const currentIndex = tabButtons.indexOf(button);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabButtons[(currentIndex + offset + tabButtons.length) % tabButtons.length];
    selectTab(next.id);
    next.focus();
  });
});

toggleButton.addEventListener("click", toggleCapture);
setMetrics();
