(() => {
  'use strict';

  const HUMAN_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/';
  const byId = (id) => document.getElementById(id);
  const video = byId('human-video');
  const canvas = byId('human-canvas');
  const context = canvas.getContext('2d');
  // Detect the exact same frame that is drawn, so landmarks line up with it.
  const frame = document.createElement('canvas');
  const frameContext = frame.getContext('2d');
  const toggle = byId('human-toggle');
  let human;
  let libraryPromise;
  let stream;
  let running = false;
  let busy = false;
  let generation = 0;
  let timer;
  let lastResult;
  let activeDetection = Promise.resolve();

  function status(message, className = '') {
    byId('human-status').textContent = message;
    byId('human-status').className = `status-chip ${className}`.trim();
  }

  async function loadHuman() {
    if (human) return;
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${HUMAN_BASE}dist/human.js`;
        script.onload = resolve;
        script.onerror = () => {
          script.remove();
          reject(new Error('Could not download Human. Check your internet connection and access to cdn.jsdelivr.net, then try again.'));
        };
        document.head.appendChild(script);
      }).catch((error) => { libraryPromise = null; throw error; });
    }
    await libraryPromise;
    if (!window.Human?.Human) throw new Error('The Human library did not initialize. Reload the page and try again.');
    const instance = new window.Human.Human({
      modelBasePath: `${HUMAN_BASE}models/`,
      backend: 'webgl',
      debug: false,
      cacheModels: true,
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: { maxDetected: 5, rotation: true, return: false },
        mesh: { enabled: true },
        iris: { enabled: false },
        attention: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: true },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: false },
    });
    await instance.load();
    await instance.warmup();
    human = instance;
  }

  function clearMetrics() {
    ['human-age', 'human-gender', 'human-emotion'].forEach((id) => { byId(id).textContent = '\u2014'; });
    byId('emotion-scores').replaceChildren();
  }

  function stop() {
    running = false;
    generation += 1;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    byId('human-placeholder').hidden = false;
    byId('human-placeholder').textContent = 'Camera stopped. Start it again when you are ready.';
    byId('face-count').textContent = '0 faces';
    byId('inference-time').textContent = 'Camera off';
    clearMetrics();
    toggle.textContent = 'Start camera';
    toggle.classList.remove('is-stop');
    status('Idle');
    byId('human-progress').textContent = human ? 'Models are ready. Results below show the last analyzed frame.' : 'Start again to load the models and open the camera.';
  }

  function errorMessage(error) {
    if (error.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in your browser and try again.';
    if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera and try again.';
    if (error.name === 'NotReadableError') return 'The camera could not be opened. Close other apps using it and try again.';
    return error.message || 'Human analysis failed. Try reloading the page.';
  }

  async function start() {
    if (busy) return;
    busy = true;
    toggle.disabled = true;
    byId('human-error').textContent = '';
    const token = ++generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost. Open this page through a secure connection.');
      }
      status('Loading', 'is-busy');
      byId('human-progress').textContent = 'Downloading and preparing the face models. This can take a moment on first use.';
      await loadHuman();
      // Let a frame from a previous camera session finish before restarting.
      await activeDetection.catch(() => {});
      if (token !== generation) return;
      status('Opening camera', 'is-busy');
      byId('human-progress').textContent = 'Allow camera access when your browser asks.';
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (token !== generation) { camera.getTracks().forEach((track) => track.stop()); return; }
      stream = camera;
      video.srcObject = stream;
      await video.play();
      if (token !== generation) return;
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (running) stop(); });
      running = true;
      byId('human-placeholder').hidden = true;
      toggle.textContent = 'Stop camera';
      toggle.classList.add('is-stop');
      byId('human-progress').textContent = 'Analyzing locally on this device. No images are uploaded.';
      status('Live', 'is-live');
      timer = setTimeout(() => detect(token), 0);
    } catch (error) {
      if (token !== generation) return;
      stop();
      status('Error');
      byId('human-error').textContent = errorMessage(error);
      console.error('Human startup failed:', error);
    } finally {
      busy = false;
      toggle.disabled = false;
    }
  }

  function drawFaces(faces) {
    faces.forEach((face, index) => {
      const [x, y, width, height] = face.box;
      context.strokeStyle = `hsl(${75 + index * 90} 85% 65%)`;
      context.fillStyle = context.strokeStyle;
      context.lineWidth = 2;
      context.strokeRect(x, y, width, height);
      context.font = 'bold 16px Segoe UI, sans-serif';
      context.fillText(`Face ${index + 1}`, x + 4, Math.max(18, y - 8));
      if (!byId('show-landmarks').checked) return;
      for (const [px, py] of face.mesh || []) {
        context.beginPath();
        context.arc(px, py, 1.2, 0, Math.PI * 2);
        context.fill();
      }
    });
  }

  const percent = (score) => Number.isFinite(score) ? `${Math.round(score * 100)}%` : '\u2014';
  const ageLabel = (face) => Number.isFinite(face.age) && face.age > 0 ? `About ${Math.round(face.age)}` : '\u2014';
  const emotions = (face) => [...(face.emotion || [])].sort((a, b) => b.score - a.score);

  function render(result, elapsed) {
    const faces = [...result.face].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
    drawFaces(faces);
    byId('face-count').textContent = `${faces.length} ${faces.length === 1 ? 'face' : 'faces'}`;
    byId('inference-time').textContent = `${Math.round(elapsed)} ms / analysis`;
    byId('human-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    clearMetrics();
    if (faces.length) {
      const face = faces[0];
      byId('human-age').textContent = ageLabel(face);
      byId('human-gender').textContent = face.gender || '\u2014';
      byId('human-emotion').textContent = emotions(face)[0]?.emotion || '\u2014';
      emotions(face).forEach(({ emotion, score }) => {
        const row = document.createElement('div');
        row.className = 'emotion-row';
        const name = document.createElement('span');
        name.textContent = emotion;
        const bar = document.createElement('progress');
        bar.max = 1;
        bar.value = score;
        bar.setAttribute('aria-label', `${emotion} score`);
        const value = document.createElement('span');
        value.textContent = percent(score);
        row.append(name, bar, value);
        byId('emotion-scores').appendChild(row);
      });
    } else {
      byId('human-emotion').textContent = 'No face detected';
    }

    byId('human-faces').replaceChildren();
    if (!faces.length) {
      const message = document.createElement('p');
      message.className = 'hint';
      message.textContent = 'No face detected. Face the camera in brighter, even lighting.';
      byId('human-faces').appendChild(message);
    }
    faces.forEach((face, index) => {
      const card = document.createElement('article');
      card.className = 'face-card';
      const heading = document.createElement('h3');
      heading.textContent = `Face ${index + 1}`;
      card.appendChild(heading);
      for (const [label, value] of [
        ['Estimated age', ageLabel(face)],
        ['Gender estimate', `${face.gender || 'Unknown'} (${percent(face.genderScore)})`],
        ['Top expression', emotions(face)[0]?.emotion || '\u2014'],
        ['Detection confidence', percent(face.boxScore)],
        ['Landmarks', face.mesh?.length || 0],
      ]) {
        const row = document.createElement('div');
        row.className = 'data-row';
        const name = document.createElement('span');
        name.textContent = label;
        const text = document.createElement('strong');
        text.textContent = value;
        row.append(name, text);
        card.appendChild(row);
      }
      byId('human-faces').appendChild(card);
    });
    lastResult = result;
    if (byId('human-raw').open) renderJson();
  }

  function renderJson() {
    if (!lastResult) return;
    // Canvas and tensors are runtime objects, not JSON result data.
    byId('human-json').textContent = JSON.stringify(lastResult, (key, value) => ['canvas', 'tensor'].includes(key) ? undefined : value, 2);
  }

  async function detect(token) {
    if (!running || token !== generation) return;
    try {
      if (document.hidden || video.readyState < 2) {
        timer = setTimeout(() => detect(token), 250);
        return;
      }
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frameContext.drawImage(video, 0, 0);
      const started = performance.now();
      activeDetection = human.detect(frame);
      const result = await activeDetection;
      if (!running || token !== generation) return;
      if (result.error) throw new Error(result.error);
      canvas.width = frame.width;
      canvas.height = frame.height;
      context.drawImage(frame, 0, 0);
      render(result, performance.now() - started);
      timer = setTimeout(() => detect(token), 150);
    } catch (error) {
      if (token !== generation) return;
      stop();
      status('Error');
      byId('human-error').textContent = `Local analysis failed: ${errorMessage(error)}`;
      console.error('Human analysis failed:', error);
    }
  }

  toggle.addEventListener('click', () => { if (running) stop(); else start(); });
  byId('human-raw').addEventListener('toggle', () => { if (byId('human-raw').open) renderJson(); });
  window.addEventListener('pagehide', stop);
})();
