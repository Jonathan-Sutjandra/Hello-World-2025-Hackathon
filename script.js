class ObjectDimensionDetector {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.detectionCanvas = document.getElementById('detectionCanvas');
        this.capturedImage = document.getElementById('capturedImage');
        this.model = null;
        this.stream = null;
        this.predictions = [];
        this.referenceObjects = {
            'coin': { width: 24, height: 24 },
            'credit-card': { width: 85.6, height: 53.98 },
            'phone': { width: 70, height: 140 },
            'custom': { width: 0, height: 0 }
        };
        
        this.initializeEventListeners();
        this.loadModel();
    }

    async loadModel() {
        try {
            console.log('Loading COCO-SSD model...');
            this.model = await cocoSsd.load();
            console.log('Model loaded successfully');
        } catch (error) {
            console.error('Error loading model:', error);
            alert('Failed to load AI model. Please refresh the page and try again.');
        }
    }

    initializeEventListeners() {
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capturePhoto').addEventListener('click', () => this.captureAndAnalyze());
        document.getElementById('uploadPhoto').addEventListener('click', () => this.uploadPhoto());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('referenceObject').addEventListener('change', (e) => this.handleReferenceChange(e));
        document.getElementById('customWidth').addEventListener('input', () => this.updateCustomReference());
        document.getElementById('customHeight').addEventListener('input', () => this.updateCustomReference());
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.video.srcObject = this.stream;
            this.video.classList.add('active');
            
            document.getElementById('startCamera').disabled = true;
            document.getElementById('capturePhoto').disabled = false;
            
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please check permissions and try again.');
        }
    }

    captureAndAnalyze() {
        if (!this.video.classList.contains('active')) {
            alert('Please start the camera first');
            return;
        }

        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        context.drawImage(this.video, 0, 0);

        const imageData = this.canvas.toDataURL('image/jpeg');
        this.analyzeImage(imageData);
    }

    uploadPhoto() {
        document.getElementById('fileInput').click();
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.analyzeImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    async analyzeImage(imageData) {
        if (!this.model) {
            alert('AI model is still loading. Please wait a moment and try again.');
            return;
        }

        this.showLoading(true);
        this.capturedImage.src = imageData;

        try {
            const img = new Image();
            img.onload = async () => {
                try {
                    const predictions = await this.model.detect(img);
                    console.log('Detections:', predictions);
                    this.displayResults(img, predictions);
                } catch (error) {
                    console.error('Error during detection:', error);
                    alert('Error analyzing image. Please try again.');
                } finally {
                    this.showLoading(false);
                }
            };
            img.src = imageData;
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
            this.showLoading(false);
        }
    }

    displayResults(image, predictions) {
        const resultsSection = document.getElementById('resultsSection');
        const objectsList = document.getElementById('objectsList');
        objectsList.innerHTML = '';

        this.detectionCanvas.width = image.width;
        this.detectionCanvas.height = image.height;
        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        this.predictions = predictions;

        predictions.forEach((prediction, index) => {
            this.drawBoundingBox(ctx, prediction);
            this.createObjectCard(prediction, image, index);
        });

        this.detectionCanvas.style.pointerEvents = "auto";
        this.detectionCanvas.addEventListener("click", (e) => this.handleCanvasClick(e, image));

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    handleCanvasClick(event, image) {
        const rect = this.detectionCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this.detectionCanvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this.detectionCanvas.height / rect.height);

        this.predictions.forEach((pred, idx) => {
            const [bx, by, bw, bh] = pred.bbox;
            if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
                this.highlightObject(pred, idx);
            }
        });
    }

    highlightObject(prediction, index) {
        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        this.predictions.forEach((p, i) => {
            if (i === index) {
                this.drawBoundingBox(ctx, p, true);
            } else {
                this.drawBoundingBox(ctx, p);
            }
        });

        const objectsList = document.getElementById('objectsList');
        const card = objectsList.children[index];
        if (card) {
            card.classList.add("highlight");
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => card.classList.remove("highlight"), 1500);
        }
    }

    drawBoundingBox(ctx, prediction, highlight = false) {
        const [x, y, width, height] = prediction.bbox;
        ctx.strokeStyle = highlight ? '#FF0000' : '#4CAF50';
        ctx.lineWidth = highlight ? 4 : 3;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = highlight ? '#FF0000' : '#4CAF50';
        ctx.font = '16px Arial';
        ctx.fillText(prediction.class, x + 5, y - 5);
    }

    createObjectCard(prediction, image, index) {
        const objectsList = document.getElementById('objectsList');
        const [x, y, width, height] = prediction.bbox;
        
        const pixelWidth = width;
        const pixelHeight = height;
        
        const referenceType = document.getElementById('referenceObject').value;
        const reference = this.referenceObjects[referenceType];
        
        const scaleFactor = this.estimateScaleFactor(image, reference);
        const realWidth = pixelWidth * scaleFactor;
        const realHeight = pixelHeight * scaleFactor;
        
        const objectCard = document.createElement('div');
        objectCard.className = 'object-item';
        objectCard.innerHTML = `
            <h3>${prediction.class} (${Math.round(prediction.score * 100)}% confidence)</h3>
            <div class="object-details">
                <div class="detail-item">
                    <div class="detail-label">Width</div>
                    <div class="detail-value">${realWidth.toFixed(1)} mm</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Height</div>
                    <div class="detail-value">${realHeight.toFixed(1)} mm</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Area</div>
                    <div class="detail-value">${(realWidth * realHeight).toFixed(1)} mm²</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Pixels</div>
                    <div class="detail-value">${Math.round(pixelWidth)} × ${Math.round(pixelHeight)}</div>
                </div>
            </div>
        `;
        
        objectsList.appendChild(objectCard);
    }

    estimateScaleFactor(image, reference) {
        const imageWidth = image.width;
        const imageHeight = image.height;
        const estimatedReferencePixels = Math.min(imageWidth, imageHeight) * 0.08;
        const scaleFactor = reference.width / estimatedReferencePixels;
        return scaleFactor;
    }

    handleReferenceChange(event) {
        const customGroup = document.getElementById('customSizeGroup');
        if (event.target.value === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
    }

    updateCustomReference() {
        const width = parseFloat(document.getElementById('customWidth').value) || 0;
        const height = parseFloat(document.getElementById('customHeight').value) || 0;
        this.referenceObjects.custom = { width, height };
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const detector = new ObjectDimensionDetector();
    window.addEventListener('beforeunload', () => {
        detector.cleanup();
    });
});
