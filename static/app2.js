// static/app2.js

// Global element references
let video, canvas, detectionCanvas, capturedImage;

document.addEventListener('DOMContentLoaded', () => {
  // Grab DOM elements
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  detectionCanvas = document.getElementById('detectionCanvas');
  capturedImage = document.getElementById('capturedImage');

  const startBtn     = document.getElementById('startCamera');
  const captureBtn   = document.getElementById('capturePhoto');
  const uploadBtn    = document.getElementById('uploadPhoto');
  const fileInput    = document.getElementById('fileInput');

  // Wire up event handlers
  startBtn.addEventListener('click',      () => { console.log('▶️ Start Camera clicked'); startCamera(); });
  captureBtn.addEventListener('click',    () => { console.log('📸 Capture Photo clicked'); capturePhoto(); });
  uploadBtn.addEventListener('click',     () => { console.log('📂 Upload Photo clicked'); fileInput.click(); });
  fileInput.addEventListener('change',     (e) => { console.log('🗂 File selected:', e.target.files[0]); handleFileUpload(e); });
  detectionCanvas.addEventListener('click', handleCanvasClick);
});


// Kick off the device camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    console.log('✅ got stream', stream);
    video.srcObject = stream;
    await video.play();
    console.log('▶️ video playing:', video.videoWidth, '×', video.videoHeight);
    document.getElementById('capturePhoto').disabled = false;
  } catch (err) {
    console.error('❌ getUserMedia error:', err);
    switch (err.name) {
      case 'NotAllowedError':
        alert('Camera permission denied. Check your browser/site settings.');
        break;
      case 'NotReadableError':
        alert('Camera already in use by another application. Close it and try again.');
        break;
      default:
        alert('Error accessing camera: ' + err.message);
    }
  }
}


// Draw a frame from the video into a hidden canvas, then send
function capturePhoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg');
  console.log('🖼️ captured image dataURL size:', dataUrl.length);
  sendImageToBackend(dataUrl);
}


// Handle user‐selected file upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('📥 file loaded, dataURL size:', e.target.result.length);
    sendImageToBackend(e.target.result);
  };
  reader.readAsDataURL(file);
}


// Send the captured or uploaded image to your Flask backend
async function sendImageToBackend(dataUrl) {
  showLoading(true);
  try {
    const formData = new FormData();
    formData.append('image', dataURLtoFile(dataUrl, 'upload.jpg'));

    const resp = await fetch('/analyze', { method: 'POST', body: formData });
    if (!resp.ok) throw new Error(resp.statusText);

    const result = await resp.json();
    displayResults(result);
  } catch (err) {
    console.error('🚨 sendImageToBackend error:', err);
    alert('Error processing image: ' + err.message);
  } finally {
    showLoading(false);
  }
}


// Convert a dataURL string into a File object
function dataURLtoFile(dataurl, filename) {
  const [meta, base64] = dataurl.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const len = binary.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binary.charCodeAt(i);
  }
  return new File([u8arr], filename, { type: mime });
}


// Render backend results: annotated image + object stats
function displayResults(result) {
  if (!result || !result.objects || result.objects.length === 0) {
    alert('No objects detected.');
    return;
  }

  // Show processed image
  //capturedImage.src = result.processed_image;

  const list = document.getElementById('objectsList');
  list.innerHTML = '';

  // ✅ Display frame info once (from first object)
  const frame = result.objects[0];
  if (frame.frame_width && frame.frame_height && frame.frame_dimes) {
    const frameInfo = document.createElement('div');
    frameInfo.className = 'frame-info';
    frameInfo.innerHTML = `
      <h2>Frame</h2>
      <div>Width: ${frame.frame_width.toFixed(2)} in</div>
      <div>Height: ${frame.frame_height.toFixed(2)} in</div>
      <div>≈ ${frame.frame_dimes.toFixed(0)} dimes fit inside</div>
    `;
    list.appendChild(frameInfo);
  }

  // ✅ Display each detected object
  result.objects.forEach((obj, i) => {
    const item = document.createElement('div');
    item.className = 'object-item';
    item.innerHTML = `
      <h3>Object ${i + 1}</h3>
      <div>Width: ${obj.width.toFixed(2)} in</div>
      <div>Height: ${obj.height.toFixed(2)} in</div>
      <div>Area: ${obj.area.toFixed(2)} in²</div>
      <div>≈ ${obj.number_of_coins.toFixed(0)} dimes fit inside</div>
    `;
    list.appendChild(item);
  });

  // ✅ Draw contours on detectionCanvas
  const ctx = detectionCanvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    detectionCanvas.width  = img.width;
    detectionCanvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 2;
    result.objects.forEach(o => {
      ctx.beginPath();
      ctx.moveTo(o.box[0][0], o.box[0][1]);
      o.box.slice(1).forEach(pt => ctx.lineTo(pt[0], pt[1]));
      ctx.closePath();
      ctx.stroke();
    });
  };
  img.src = result.processed_image;
}


// (Optional) Handle clicks on the detectionCanvas for per‐object actions
function handleCanvasClick(e) {
  // e.offsetX, e.offsetY are the click coords
  // You could map them back to one of your result.objects here
}


// Show or hide the full‐screen loading overlay
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
