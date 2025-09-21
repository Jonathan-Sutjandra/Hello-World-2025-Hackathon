from flask import Flask, request, jsonify, render_template
import cv2
import numpy as np
from object_size_module import process_image
import base64

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
