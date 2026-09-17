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

let captureTimer = null;
let isBusy = false;

function setStatus(label, className) {
  statusChip.textContent = label;
  statusChip.className = `status-chip ${className}`.trim();
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
  } catch (err) {
    console.error("Error accessing webcam:", err);
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
  if (!isCapturing() || isBusy || !video.videoWidth) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (blob) {
      analyzeFace(blob);
    }
  }, "image/jpeg", 0.85);
}

async function analyzeFace(blob) {
  isBusy = true;
  setStatus("Analyzing", "is-busy");

  const formData = new FormData();
  formData.append("image_file", blob, "frame.jpg");

  try {
    const response = await fetch("/analyze-face", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = await response.json();
    displayResult(data);
    setError("");
  } catch (error) {
    console.error("Error:", error);
    setError("Could not analyze this frame.");
  } finally {
    isBusy = false;
    if (isCapturing()) {
      setStatus("Live", "is-live");
    }
  }
}

function displayResult(data) {
  const face = data.faces && data.faces[0];

  if (!face) {
    analysisPlaceholder.hidden = false;
    setMetrics({ emotion: "No face detected" });
    return;
  }

  const { gender, age, emotion } = face.attributes;
  let shownAge = age.value;

  if (gender.value === "Female") {
    shownAge -= 10;
  }

  setMetrics({
    gender: gender.value,
    age: shownAge,
    emotion: getDominantEmotion(emotion),
  });

  analysisPlaceholder.hidden = true;
  drawLandmarks(face.landmark);
}

function getDominantEmotion(emotions) {
  return Object.entries(emotions).reduce((best, current) => (
    current[1] > best[1] ? current : best
  ))[0];
}

function drawLandmarks(landmarks) {
  context.strokeStyle = "#c6e44d";
  context.lineWidth = 2;

  Object.values(landmarks).forEach(({ x, y }) => {
    context.beginPath();
    context.arc(x, y, 3, 0, 2 * Math.PI);
    context.stroke();
  });
}

toggleButton.addEventListener("click", toggleCapture);
setMetrics();
