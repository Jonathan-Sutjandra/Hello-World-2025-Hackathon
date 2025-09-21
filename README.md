# Welcome to DimEnvision

A web app that lets users measure physical objects using images from a camera or uploaded photos. The app automatically removes the background, detects objects, and calculates dimensions in inches, along with the number of coins (dimes) that could fit inside each object.

Built with Python, Flask, OpenCV, JavaScript, and Cloudflare Tunnel for easy online access.

Features ✨

Capture objects using your phone camera or upload an image.

Automatic background removal using U2Net.

Object detection and contour measurement.

Calculates object width, height, area, and estimated number of dimes that fit inside.

Annotated images with measurement overlays.

Interactive canvas to visualize object contours.

Demo

(replace with your own image if available)

Installation 💻

Clone the repository:

git clone https://github.com/yourusername/object-measurement-webapp.git
cd object-measurement-webapp


Create a virtual environment (recommended):

python -m venv venv
source venv/bin/activate  # Linux / macOS
venv\Scripts\activate     # Windows


Install dependencies:

pip install -r requirements.txt


Install Cloudflare Tunnel (cloudflared):

Follow instructions from Cloudflare Tunnel
.

Running the App 🚀

Start the Flask app with Cloudflare tunnel:

python app3.py


Access the public URL printed in the terminal:

🚀 Public URL: https://<random-subdomain>.trycloudflare.com


Use your phone or computer to visit the URL and capture/upload an image.

File Structure 🗂️
├─ app3.py                  # Main Flask app + Cloudflare integration
├─ object_size_module.py    # Image processing & measurement logic
├─ templates/
│   └─ index2.html          # Frontend HTML
├─ static/
│   ├─ app2.js              # Frontend JavaScript
│   └─ styles.css           # Frontend CSS
├─ assets/                  # Temporary image storage + screenshots
│   ├─ input_tmp.png
│   ├─ bg_tmp.png
│   ├─ mask_tmp.png
│   └─ screenshot.png
└─ requirements.txt         # Python dependencies

How it Works ⚙️

Frontend:

Users capture a photo or upload an image.

JavaScript converts the image to a File object and sends it via POST to /analyze.

Backend (Flask):

Receives the image and decodes it using OpenCV.

Calls process_image() from object_size_module.py:

Removes background with U2Net.

Detects objects using contours.

Measures dimensions relative to a reference coin (dime).

Annotates the image with boxes and measurement lines.

Returns JSON containing:

processed_image (base64-encoded)

objects (width, height, area, number of dimes, frame info)

Frontend display:

Shows annotated image and object measurements.

Draws contours on a canvas overlay.

Dependencies 📦

Python 3.10+

Flask

OpenCV (opencv-python)

NumPy

SciPy

imutils

backgroundremover (backgroundremover-bg)

Cloudflared (for public tunneling)

pip install flask opencv-python numpy scipy imutils backgroundremover

Tips for Hackathon Judges 🎯

No browser auto-opening: The app prints the public URL to the console. Open it manually.

Upload first: If camera permissions fail, upload an image instead.

Temporary files: Images are saved temporarily in the assets/ folder. It’s cleaned automatically per session.

Contributing 🤝

Contributions are welcome!

Submit pull requests for bug fixes or features.

Open issues for questions or improvements.

License 📜

This project is licensed under the MIT License.
