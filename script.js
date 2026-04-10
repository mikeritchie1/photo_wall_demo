const controls = document.getElementById("controls");
const sizeSlider = document.getElementById("sizeSlider");
const speedSlider = document.getElementById("speedSlider");
const folderSelect = document.getElementById("folderSelect");
const backgroundSelect = document.getElementById("backgroundSelect");
const lightColorSelect = document.getElementById("lightColorSelect");
const stringColorSelect = document.getElementById("stringColorSelect");
const reverseCheckbox = document.getElementById("reverseCheckbox");
const swaySlider = document.getElementById("swaySlider");
const lightColumnsSelect = document.getElementById("lightColumnsSelect");
const textSelect = document.getElementById("textSelect");
const resetControlsBtn = document.getElementById("resetControlsBtn");
const wall = document.getElementById("wall");
const R2_BASE_URL = "https://pub-bd90151148dc4ad4a6dcce4b188be9ac.r2.dev";
const isLocalRuntime =
  location.protocol === "file:" ||
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";
const PHOTO_BASE_URL = isLocalRuntime ? "images" : R2_BASE_URL;
const MANIFEST_URL = isLocalRuntime ? "images/manifest.json" : `${R2_BASE_URL}/manifest.json`;

const lightsLeft = document.getElementById("lights-left");
const lightsCenter = document.getElementById("lights-center");
const lightsRight = document.getElementById("lights-right");

let hideTimer;
let photoWidth = parseFloat(sizeSlider.value);
let verticalSpeed = parseFloat(speedSlider.value);
let currentLightColor = 'warm';
let swayPower = parseFloat(swaySlider.value);
let textMode = 'auto';
let lightColumnCount = 2;
let lightOffsetY = 0;
let lastRenderTimeSec = null;

const leftXRatio = 0.24;
const rightXRatio = 0.76;
const photosPerColumn = 6;
const lightBulbSpacing = 95;
const DEFAULT_CONTROL_VALUES = {
  folder: "all",
  size: "420",
  speed: "0.5",
  reverse: false,
  sway: "3",
  lightColumns: "2",
  background: "none",
  lightColor: "warm",
  stringColor: "brown",
  text: "auto"
};

const photos = [
  { container: document.getElementById("photo1-container"), imgEl: document.getElementById("photo1"), textEl: document.getElementById("photo1-text"), column: "left", index: 0, rotation: -8, swayOffset: 0.0 },
  { container: document.getElementById("photo2-container"), imgEl: document.getElementById("photo2"), textEl: document.getElementById("photo2-text"), column: "left", index: 1, rotation:  6, swayOffset: 0.9 },
  { container: document.getElementById("photo3-container"), imgEl: document.getElementById("photo3"), textEl: document.getElementById("photo3-text"), column: "left", index: 2, rotation: -5, swayOffset: 1.8 },
  { container: document.getElementById("photo4-container"), imgEl: document.getElementById("photo4"), textEl: document.getElementById("photo4-text"), column: "left", index: 3, rotation:  7, swayOffset: 2.7 },
  { container: document.getElementById("photo9-container"), imgEl: document.getElementById("photo9"), textEl: document.getElementById("photo9-text"), column: "left", index: 4, rotation: -4, swayOffset: 3.6 },
  { container: document.getElementById("photo10-container"), imgEl: document.getElementById("photo10"), textEl: document.getElementById("photo10-text"), column: "left", index: 5, rotation:  8, swayOffset: 4.5 },

  { container: document.getElementById("photo13-container"), imgEl: document.getElementById("photo13"), textEl: document.getElementById("photo13-text"), column: "center", index: 0, rotation: -7, swayOffset: 0.2 },
  { container: document.getElementById("photo14-container"), imgEl: document.getElementById("photo14"), textEl: document.getElementById("photo14-text"), column: "center", index: 1, rotation:  5, swayOffset: 1.1 },
  { container: document.getElementById("photo15-container"), imgEl: document.getElementById("photo15"), textEl: document.getElementById("photo15-text"), column: "center", index: 2, rotation: -6, swayOffset: 2.0 },
  { container: document.getElementById("photo16-container"), imgEl: document.getElementById("photo16"), textEl: document.getElementById("photo16-text"), column: "center", index: 3, rotation:  7, swayOffset: 2.9 },
  { container: document.getElementById("photo17-container"), imgEl: document.getElementById("photo17"), textEl: document.getElementById("photo17-text"), column: "center", index: 4, rotation: -5, swayOffset: 3.8 },
  { container: document.getElementById("photo18-container"), imgEl: document.getElementById("photo18"), textEl: document.getElementById("photo18-text"), column: "center", index: 5, rotation:  6, swayOffset: 4.7 },

  { container: document.getElementById("photo5-container"), imgEl: document.getElementById("photo5"), textEl: document.getElementById("photo5-text"), column: "right", index: 0, rotation: -6, swayOffset: 0.4 },
  { container: document.getElementById("photo6-container"), imgEl: document.getElementById("photo6"), textEl: document.getElementById("photo6-text"), column: "right", index: 1, rotation:  5, swayOffset: 1.3 },
  { container: document.getElementById("photo7-container"), imgEl: document.getElementById("photo7"), textEl: document.getElementById("photo7-text"), column: "right", index: 2, rotation: -7, swayOffset: 2.2 },
  { container: document.getElementById("photo8-container"), imgEl: document.getElementById("photo8"), textEl: document.getElementById("photo8-text"), column: "right", index: 3, rotation:  6, swayOffset: 3.1 },
  { container: document.getElementById("photo11-container"), imgEl: document.getElementById("photo11"), textEl: document.getElementById("photo11-text"), column: "right", index: 4, rotation: -5, swayOffset: 4.0 },
  { container: document.getElementById("photo12-container"), imgEl: document.getElementById("photo12"), textEl: document.getElementById("photo12-text"), column: "right", index: 5, rotation:  7, swayOffset: 4.9 }
];

textSelect.value = "auto";

function sortPhotosForQueue(items) {
  return [...items].sort((a, b) => {
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    const columnRank = { left: 0, center: 1, right: 2 };
    return columnRank[a.column] - columnRank[b.column];
  });
}

function getActivePhotos() {
  if (lightColumnCount === 3) {
    return photos;
  }
  return photos.filter((photo) => photo.column !== "center");
}

let activeQueuePhotos = sortPhotosForQueue(getActivePhotos());

let manifest = null;
let selectedFolder = "all";
let imageCycle = [];
let imageCycleIndex = 0;
let lastServedImageKey = null;

function syncPhotoScaleVars() {
  const textSize = Math.max(12, Math.min(40, photoWidth / 18));
  document.documentElement.style.setProperty("--photo-width", `${photoWidth}px`);
  document.documentElement.style.setProperty("--photo-text-size", `${textSize}px`);
  for (const photo of photos) {
    photo.textEl.style.fontSize = `${textSize}px`;
  }
}

async function loadManifest() {
  try {
    const response = await fetch(MANIFEST_URL);
    manifest = await response.json();
    populateFolderSelect();
  } catch (error) {
    console.error("Error loading manifest:", error);
  }
}

function populateFolderSelect() {
  folderSelect.innerHTML = "";
  if (!manifest) return;

  // Add "all" option first
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  allOption.selected = true;
  folderSelect.appendChild(allOption);

  // Add individual folders
  for (const folder of Object.keys(manifest)) {
    const option = document.createElement("option");
    option.value = folder;
    option.textContent = folder;
    if (folder === selectedFolder) {
      option.selected = true;
    }
    folderSelect.appendChild(option);
  }
}

folderSelect.addEventListener("change", (event) => {
  selectedFolder = event.target.value;
  resetImageCycle();
  assignRandomImages();
  resetHideTimer();
});

backgroundSelect.addEventListener("change", (event) => {
  applyBackground(event.target.value);
  resetHideTimer();
});

lightColorSelect.addEventListener("change", (event) => {
  applyLightColor(event.target.value);
  resetHideTimer();
});

stringColorSelect.addEventListener("change", (event) => {
  applyStringColor(event.target.value);
  resetHideTimer();
});

textSelect.addEventListener("change", (event) => {
  textMode = event.target.value;
  assignRandomImages();
  resetHideTimer();
});

lightColumnsSelect.addEventListener("change", (event) => {
  lightColumnCount = parseInt(event.target.value, 10) === 3 ? 3 : 2;
  updateLightStreamVisibility();
  updateCenterPhotoVisibility();
  activeQueuePhotos = sortPhotosForQueue(getActivePhotos());
  layoutLights();
  layoutPhotos();
  assignRandomImages();
  resetHideTimer();
});

resetControlsBtn.addEventListener("click", () => {
  resetControlsToDefaults();
});

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function resolveImagePath(image, folder) {
  if (image.path) {
    return image.path;
  }
  if (folder.toLowerCase() === "various") {
    return image.filename;
  }
  return `${folder}/${image.filename}`;
}

function buildPhotoUrl(relativePath) {
  const encodedPath = relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${PHOTO_BASE_URL}/${encodedPath}`;
}

function buildImagePool() {
  if (!manifest) {
    return [];
  }

  const pool = [];

  if (selectedFolder === "all") {
    for (const [folder, images] of Object.entries(manifest)) {
      for (const image of images) {
        const relativePath = resolveImagePath(image, folder);
        pool.push({
          filename: buildPhotoUrl(relativePath),
          text: image.text || "",
          folder,
          date: image.date || "",
          _key: relativePath
        });
      }
    }
    return pool;
  }

  const images = manifest[selectedFolder] || [];
  for (const image of images) {
    const relativePath = resolveImagePath(image, selectedFolder);
    pool.push({
      filename: buildPhotoUrl(relativePath),
      text: image.text || "",
      folder: selectedFolder,
      date: image.date || "",
      _key: relativePath
    });
  }

  return pool;
}

function resetImageCycle() {
  const pool = buildImagePool();
  imageCycle = shuffleArray(pool);
  imageCycleIndex = 0;

  // Prevent the first image in the new cycle from repeating the previous image.
  if (imageCycle.length > 1 && lastServedImageKey && imageCycle[0]._key === lastServedImageKey) {
    const swapIndex = 1 + Math.floor(Math.random() * (imageCycle.length - 1));
    [imageCycle[0], imageCycle[swapIndex]] = [imageCycle[swapIndex], imageCycle[0]];
  }
}

function getNextImage() {
  if (!manifest) {
    return { filename: "images/photo1.png", text: "", folder: "test", date: "", _key: "fallback/photo1" };
  }

  if (imageCycle.length === 0 || imageCycleIndex >= imageCycle.length) {
    resetImageCycle();
  }

  if (imageCycle.length === 0) {
    return { filename: "images/photo1.png", text: "", folder: "test", date: "", _key: "fallback/photo1" };
  }

  const imageData = imageCycle[imageCycleIndex];
  imageCycleIndex += 1;
  lastServedImageKey = imageData._key;
  return imageData;
}

function setupClickListeners() {
  for (const photo of photos) {
    photo.container.addEventListener("click", (event) => {
      event.stopPropagation();
      assignRandomImageToPhoto(photo);
    });
  }
}

function assignRandomImages() {
  for (const photo of activeQueuePhotos) {
    assignRandomImageToPhoto(photo);
  }
}

function assignRandomImageToPhoto(photo) {
  const imageData = getNextImage();
  photo.imgEl.src = imageData.filename;

  if (textMode === 'disabled') {
    photo.textEl.textContent = '';
    return;
  }

  const customText = (imageData.text || '').trim();
  if (customText) {
    photo.textEl.textContent = customText;
    return;
  }

  let displayText = '';
  switch(textMode) {
    case 'auto':
      displayText = imageData.folder.toLowerCase() === 'various'
        ? imageData.date
        : imageData.folder;
      break;
    case 'custom':
      displayText = imageData.text;
      break;
    case 'name':
      displayText = imageData.folder;
      break;
    case 'date':
      displayText = imageData.date;
      break;
  }
  photo.textEl.textContent = displayText;
}

function resetControlsToDefaults() {
  selectedFolder = DEFAULT_CONTROL_VALUES.folder;
  folderSelect.value = DEFAULT_CONTROL_VALUES.folder;

  sizeSlider.value = DEFAULT_CONTROL_VALUES.size;
  photoWidth = parseFloat(DEFAULT_CONTROL_VALUES.size);
  syncPhotoScaleVars();

  speedSlider.value = DEFAULT_CONTROL_VALUES.speed;
  reverseCheckbox.checked = DEFAULT_CONTROL_VALUES.reverse;
  verticalSpeed = parseFloat(DEFAULT_CONTROL_VALUES.speed);

  swaySlider.value = DEFAULT_CONTROL_VALUES.sway;
  swayPower = parseFloat(DEFAULT_CONTROL_VALUES.sway);

  lightColumnsSelect.value = DEFAULT_CONTROL_VALUES.lightColumns;
  lightColumnCount = parseInt(DEFAULT_CONTROL_VALUES.lightColumns, 10);
  updateLightStreamVisibility();
  updateCenterPhotoVisibility();
  activeQueuePhotos = sortPhotosForQueue(getActivePhotos());

  if (backgroundSelect.querySelector(`option[value="${DEFAULT_CONTROL_VALUES.background}"]`)) {
    backgroundSelect.value = DEFAULT_CONTROL_VALUES.background;
  }
  applyBackground(backgroundSelect.value);

  lightColorSelect.value = DEFAULT_CONTROL_VALUES.lightColor;
  applyLightColor(DEFAULT_CONTROL_VALUES.lightColor);

  stringColorSelect.value = DEFAULT_CONTROL_VALUES.stringColor;
  applyStringColor(DEFAULT_CONTROL_VALUES.stringColor);

  textSelect.value = DEFAULT_CONTROL_VALUES.text;
  textMode = DEFAULT_CONTROL_VALUES.text;

  layoutPhotos();
  resetImageCycle();
  assignRandomImages();
  resetHideTimer();
}

function applyLightColor(color) {
  currentLightColor = color;
  if (color === 'rainbow') {
    // Will be animated in render
    return;
  }
  const bulbs = document.querySelectorAll('.bulb');
  bulbs.forEach(bulb => {
    switch(color) {
      case 'warm':
        bulb.style.background = 'radial-gradient(circle, #fff6cc 0%, #ffd36a 45%, #ffb347 100%)';
        bulb.style.boxShadow = '0 0 10px rgba(255, 210, 100, 0.95), 0 0 22px rgba(255, 190, 80, 0.6), 0 0 40px rgba(255, 180, 80, 0.25)';
        break;
      case 'cool':
        bulb.style.background = 'radial-gradient(circle, #e6f7ff 0%, #b3e0ff 45%, #80ccff 100%)';
        bulb.style.boxShadow = '0 0 10px rgba(179, 224, 255, 0.95), 0 0 22px rgba(128, 204, 255, 0.6), 0 0 40px rgba(255, 180, 80, 0.25)';
        break;
      case 'red':
        bulb.style.background = 'radial-gradient(circle, #ffe6e6 0%, #ffb3b3 45%, #ff8080 100%)';
        bulb.style.boxShadow = '0 0 10px rgba(255, 179, 179, 0.95), 0 0 22px rgba(255, 128, 128, 0.6), 0 0 40px rgba(255, 102, 102, 0.25)';
        break;
      case 'blue':
        bulb.style.background = 'radial-gradient(circle, #e6f7ff 0%, #b3e0ff 45%, #4da6ff 100%)';
        bulb.style.boxShadow = '0 0 10px rgba(179, 224, 255, 0.95), 0 0 22px rgba(77, 166, 255, 0.6), 0 0 40px rgba(51, 133, 255, 0.25)';
        break;
      case 'green':
        bulb.style.background = 'radial-gradient(circle, #e6ffe6 0%, #b3ffb3 45%, #66ff66 100%)';
        bulb.style.boxShadow = '0 0 10px rgba(179, 255, 179, 0.95), 0 0 22px rgba(102, 255, 102, 0.6), 0 0 40px rgba(77, 255, 77, 0.25)';
        break;
    }
  });
}

function applyStringColor(color) {
  const wires = document.querySelectorAll('.light-wire');
  wires.forEach(wire => {
    switch(color) {
      case 'brown':
        wire.style.background = 'linear-gradient(to bottom, rgba(120, 90, 40, 0.9), rgba(80, 60, 30, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(255, 210, 120, 0.12)';
        break;
      case 'black':
        wire.style.background = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(20, 20, 20, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(0, 0, 0, 0.12)';
        break;
      case 'white':
        wire.style.background = 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(255, 255, 255, 0.12)';
        break;
      case 'red':
        wire.style.background = 'linear-gradient(to bottom, rgba(139, 0, 0, 0.9), rgba(100, 0, 0, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(139, 0, 0, 0.12)';
        break;
      case 'blue':
        wire.style.background = 'linear-gradient(to bottom, rgba(0, 0, 139, 0.9), rgba(0, 0, 100, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(0, 0, 139, 0.12)';
        break;
      case 'green':
        wire.style.background = 'linear-gradient(to bottom, rgba(0, 100, 0, 0.9), rgba(0, 80, 0, 0.85))';
        wire.style.boxShadow = '0 0 6px rgba(0, 100, 0, 0.12)';
        break;
    }
  });
}

const lightStreams = [
  {
    el: lightsLeft,
    column: "left",
    y: 0
  },
  {
    el: lightsCenter,
    column: "center",
    y: 0
  },
  {
    el: lightsRight,
    column: "right",
    y: 0
  }
];

function getActiveLightStreams() {
  if (lightColumnCount === 3) {
    return lightStreams;
  }
  return lightStreams.filter((stream) => stream.column !== "center");
}

function updateLightStreamVisibility() {
  lightsCenter.style.display = lightColumnCount === 3 ? "block" : "none";
}

function updateCenterPhotoVisibility() {
  const isVisible = lightColumnCount === 3;
  for (const photo of photos) {
    if (photo.column === "center") {
      photo.container.style.display = isVisible ? "block" : "none";
    }
  }
}

function buildLightStream(streamEl) {
  streamEl.innerHTML = "";

  const wire = document.createElement("div");
  wire.className = "light-wire";
  streamEl.appendChild(wire);

  const streamHeight = 2400;
  streamEl.style.height = `${streamHeight}px`;

  for (let y = 40; y < streamHeight; y += lightBulbSpacing) {
    const bulb = document.createElement("div");
    bulb.className = "bulb";
    bulb.style.top = `${y}px`;
    streamEl.appendChild(bulb);
  }
}

buildLightStream(lightsLeft);
buildLightStream(lightsCenter);
buildLightStream(lightsRight);
updateLightStreamVisibility();
updateCenterPhotoVisibility();

function getPhotoWidth(photo) {
  return photo.imgEl.offsetWidth || photoWidth;
}

function getPhotoHeight(photo) {
  if (photo.imgEl.offsetHeight > 0) {
    return photo.imgEl.offsetHeight;
  }
  return photoWidth;
}

function getSpacing(photo) {
  return photoWidth + 80;
}

function getColumnX(column, width) {
  const halfWidth = width / 2;
  let rawX = window.innerWidth * rightXRatio;
  if (column === "left") {
    rawX = window.innerWidth * leftXRatio;
  } else if (column === "center") {
    rawX = window.innerWidth * 0.5;
  }

  const minX = halfWidth + 20;
  const maxX = window.innerWidth - halfWidth - 20;
  return Math.max(minX, Math.min(maxX, rawX));
}

function layoutPhotos() {
  const spacing = photoWidth + 80;
  const streamHeight = spacing * photosPerColumn;
  const startY = window.innerHeight / 2 - streamHeight / 2;

  for (const photo of getActivePhotos()) {
    const width = getPhotoWidth(photo);
    photo.x = getColumnX(photo.column, width);
    photo.y = startY + photo.index * spacing + spacing / 2;
  }

  layoutLights();
}

function layoutLights() {
  const leftX = getColumnX("left", 70);
  const centerX = getColumnX("center", 70);
  const rightX = getColumnX("right", 70);

  for (const stream of getActiveLightStreams()) {
    const x = stream.column === "left"
      ? leftX
      : stream.column === "center"
      ? centerX
      : rightX;
    stream.x = x;
  }
}

function wrapPhoto(photo) {
  const spacing = getSpacing(photo);
  const totalSpan = spacing * photosPerColumn;
  const halfHeight = getPhotoHeight(photo) / 2;

  if (verticalSpeed > 0 && photo.y - halfHeight > window.innerHeight) {
    photo.y -= totalSpan;
    assignRandomImageToPhoto(photo);
  } else if (verticalSpeed < 0 && photo.y + halfHeight < 0) {
    photo.y += totalSpan;
    assignRandomImageToPhoto(photo);
  }
}

function showControls() {
  controls.classList.remove("hidden");
  resetHideTimer();
}

function hideControls() {
  controls.classList.add("hidden");
}

function resetHideTimer() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideControls();
  }, 2500);
}

document.addEventListener("click", () => {
  showControls();
});

controls.addEventListener("click", (event) => {
  event.stopPropagation();
});

sizeSlider.addEventListener("input", () => {
  photoWidth = parseFloat(sizeSlider.value);
  syncPhotoScaleVars();
  layoutPhotos();
  resetHideTimer();
});

speedSlider.addEventListener("input", () => {
  const speed = parseFloat(speedSlider.value);
  verticalSpeed = reverseCheckbox.checked ? -speed : speed;
  resetHideTimer();
});

reverseCheckbox.addEventListener("change", () => {
  const speed = parseFloat(speedSlider.value);
  verticalSpeed = reverseCheckbox.checked ? -speed : speed;
  resetHideTimer();
});

swaySlider.addEventListener("input", () => {
  swayPower = parseFloat(swaySlider.value);
  resetHideTimer();
});

[sizeSlider, speedSlider, swaySlider].forEach(slider => {
  slider.addEventListener("mousedown", resetHideTimer);
  slider.addEventListener("mousemove", resetHideTimer);
  slider.addEventListener("touchstart", resetHideTimer);
  slider.addEventListener("touchmove", resetHideTimer);
});

function updateLights(time, deltaSeconds) {
  const t = time * 0.001;
  lightOffsetY += verticalSpeed * 60 * deltaSeconds;
  const phaseByColumn = {
    left: 0,
    center: 0.75,
    right: 1.5
  };

  for (const stream of getActiveLightStreams()) {
    const swayX = Math.sin(t * 0.7 + phaseByColumn[stream.column]) * 6;
    const wrappedY = ((lightOffsetY % lightBulbSpacing) + lightBulbSpacing) % lightBulbSpacing;

    stream.el.style.transform =
      `translate(${stream.x + swayX}px, ${wrappedY - 100}px) translateX(-50%)`;
  }
}

function render(time) {
  const t = time * 0.001;
  const deltaSeconds = lastRenderTimeSec === null ? 0 : (t - lastRenderTimeSec);
  lastRenderTimeSec = t;

  for (const photo of activeQueuePhotos) {
    photo.y += verticalSpeed;
    wrapPhoto(photo);

    const sway = Math.sin(t + photo.swayOffset) * swayPower;
    const bob = Math.sin((t * 0.8) + photo.swayOffset) * 4;

    photo.container.style.transform =
      `translate(${photo.x}px, ${photo.y + bob}px) translate(-50%, -50%) rotate(${photo.rotation + sway}deg)`;
  }

  updateLights(time, deltaSeconds);

  if (currentLightColor === 'rainbow') {
    const t = time * 0.001;
    const hue = (t * 50) % 360;
    const color = `hsl(${hue}, 100%, 70%)`;
    const bulbs = document.querySelectorAll('.bulb');
    bulbs.forEach(bulb => {
      bulb.style.background = `radial-gradient(circle, ${color} 0%, ${color} 100%)`;
      bulb.style.boxShadow = `0 0 10px ${color}, 0 0 22px ${color}, 0 0 40px ${color}`;
    });
  }

  requestAnimationFrame(render);
}

window.addEventListener("resize", layoutPhotos);

syncPhotoScaleVars();
layoutPhotos();
hideControls();

// Load manifest and initialize images
loadManifest().then(() => {
  resetImageCycle();
  setupClickListeners();
  assignRandomImages();
});

// Populate background selector
populateBackgroundSelect();

requestAnimationFrame(render);
