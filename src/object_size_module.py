# object_size_module.py

import cv2
import numpy as np
from scipy.spatial import distance as dist
from imutils import perspective, contours, grab_contours
from backgroundremover.bg import remove

def remove_bg_with_mask(src_img_path, out_img_path, mask_path):
    """
    Remove background from image and save RGBA output and alpha mask.
    """
    model_choices = ["u2net", "u2net_human_seg", "u2netp"]

    with open(src_img_path, "rb") as f:
        data = f.read()

    img_bytes = remove(
        data,
        model_name=model_choices[0],
        alpha_matting=True,
        alpha_matting_foreground_threshold=100,
        alpha_matting_background_threshold=140,
        alpha_matting_erode_structure_size=5,
        alpha_matting_base_size=1000
    )

    with open(out_img_path, "wb") as f:
        f.write(img_bytes)

    nparr = np.frombuffer(img_bytes, np.uint8)
    rgba  = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

    if rgba is not None and rgba.shape[2] == 4:
        alpha = rgba[:, :, 3]
        cv2.imwrite(mask_path, alpha)
    else:
        raise RuntimeError("Background removal failed: no alpha channel")

def midpoint(ptA, ptB):
    return ((ptA[0] + ptB[0]) * 0.5, (ptA[1] + ptB[1]) * 0.5)

def process_image(image_bgr, ref_width_in=0.705):
    """
    Process an image, remove background, find objects, and measure them.
    Returns annotated image and list of object measurements.
    """
    coin_area = ref_width_in ** 2
    # 1. Save input temporarily
    input_path    = "assets/input_tmp.png"
    bg_out_path   = "assets/bg_tmp.png"
    mask_out_path = "assets/mask_tmp.png"
    cv2.imwrite(input_path, image_bgr)

    # 2. Remove background + extract mask
    remove_bg_with_mask(input_path, bg_out_path, mask_out_path)

    # 3. Load mask
    mask_img = cv2.imread(mask_out_path, cv2.IMREAD_GRAYSCALE)
    if mask_img is None:
        raise FileNotFoundError(f"Cannot load mask at {mask_out_path}")

    # Threshold to binary
    _, mask = cv2.threshold(mask_img, 127, 255, cv2.THRESH_BINARY)

    # Morphological closing to fill holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # Find contours
    cnts = grab_contours(cv2.findContours(mask.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE))
    if not cnts:
        return image_bgr, []

    cnts, _ = contours.sort_contours(cnts)

    objects = []
    for c in cnts:
        if cv2.contourArea(c) < 100:
            continue
        box = cv2.minAreaRect(c)
        box = cv2.boxPoints(box)
        box = perspective.order_points(box)
        tl, tr, br, bl = box
        tltr = midpoint(tl, tr)
        blbr = midpoint(bl, br)
        tlbl = midpoint(tl, bl)
        trbr = midpoint(tr, br)

        dA = dist.euclidean(tltr, blbr)
        dB = dist.euclidean(tlbl, trbr)

        objects.append({
            "box": box,
            "dims": (dA, dB),
            "midpoints": (tltr, blbr, tlbl, trbr)
        })

    if not objects:
        return image_bgr, []

    # Pick coin as reference (smallest by area)
    coin_obj = min(objects, key=lambda o: o["dims"][0] * o["dims"][1])
    coin_w, coin_l = coin_obj["dims"]
    width_modifier  = coin_w / ref_width_in
    length_modifier = coin_l / ref_width_in
    frame_h, frame_w = image_bgr.shape[:2]
    frame_w_in = frame_w / width_modifier
    frame_h_in = frame_h / length_modifier
    frame_area = frame_w_in * frame_h_in
    frame_dimes = frame_area / coin_area
    # Annotate image
    annotated = image_bgr.copy()
    results = []

    for obj in objects:
        tltr, blbr, tlbl, trbr = obj["midpoints"]
        dA, dB = obj["dims"]

        real_w = dA / width_modifier
        real_h = dB / length_modifier

        # Draw box
        cv2.drawContours(annotated, [obj["box"].astype("int")], -1, (0, 255, 0), 2)
        # Draw measurement lines
        cv2.line(annotated, tuple(map(int, tltr)), tuple(map(int, blbr)), (255, 0, 255), 2)
        cv2.line(annotated, tuple(map(int, tlbl)), tuple(map(int, trbr)), (255, 0, 255), 2)
        # Put text
        cv2.putText(annotated, f"{real_h:.2f} in", (int(tltr[0]-15), int(tltr[1]-10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255,255,255), 2)
        cv2.putText(annotated, f"{real_w:.2f} in", (int(trbr[0]+10), int(trbr[1])),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255,255,255), 2)

        results.append({
            "width": real_w,
            "height": real_h,
            "area": real_w * real_h,
            "box": [pt.tolist() for pt in obj["box"]],
            "number_of_coins": real_w * real_h/coin_area,
            "frame_width": frame_w_in,
            "frame_height": frame_h_in,
            "frame_dimes": frame_dimes
        })

    return annotated, results
