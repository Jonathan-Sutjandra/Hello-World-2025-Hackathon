from flask import Flask, request, jsonify, render_template
import cv2
import numpy as np
from object_size_module import process_image
import base64
import subprocess
import threading
import webbrowser

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index2.html")  # loads templates/index2.html

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        # get uploaded image
        file = request.files['image']
        image = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)

        # process image
        annotated, results = process_image(image)

        # encode annotated image to base64
        _, buffer = cv2.imencode('.jpg', annotated)
        processed_image = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        return jsonify({"processed_image": processed_image, "objects": results})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def run_flask():
    app.run(host="0.0.0.0", port=5000, debug=False)


if __name__ == "__main__":
    # Run Flask in a background thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Start Cloudflared tunnel
    process = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", "http://localhost:5000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Look for the public URL in the output
    for line in process.stdout:
        if "trycloudflare.com" in line:
            public_url = line.split()[-1].strip()
            print("🚀 Public URL:", public_url)
            # try:
            #     webbrowser.open(public_url)  # auto-open in default browser
            # except:
            #     pass
            break

    # Keep streaming Cloudflared logs so it stays alive
    for line in process.stdout:
        print(line, end="")
