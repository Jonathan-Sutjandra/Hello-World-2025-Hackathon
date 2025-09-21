# object_size.py
from scipy.spatial import distance as dist
from imutils import perspective
from imutils import contours
import numpy as np
import argparse
import imutils
import cv2
import sys
import background_remove


def midpoint(ptA, ptB):
    return ((ptA[0] + ptB[0]) * 0.5, (ptA[1] + ptB[1]) * 0.5)


# parse arguments
ap = argparse.ArgumentParser()
ap.add_argument("-i", "--image", required=True, help="path to the input image")
args = vars(ap.parse_args())

# remove background and get mask
cutout_path = "assets/returned_image.png"
mask_path = "assets/returned_mask.png"
background_remove.remove_bg_with_mask(args["image"], cutout_path, mask_path)

# load mask
mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
if mask is None:
    print("Error: could not load mask.")
    sys.exit(1)


# ensure binary
_, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

# fill holes / smooth boundaries
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

# find contours
cnts = cv2.findContours(mask.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnts = imutils.grab_contours(cnts)

if not cnts:
    print("No objects found!")
    sys.exit(0)

# sort contours left-to-right
(cnts, _) = contours.sort_contours(cnts)

# coin reference (dime diameter in inches)
dime_diameter = 0.705

objects = []

# loop over contours
for c in cnts:
    if cv2.contourArea(c) < 100:
        continue

    box = cv2.minAreaRect(c)
    box = cv2.boxPoints(box) if not imutils.is_cv2() else cv2.cv.BoxPoints(box)
    box = np.array(box, dtype="int")
    box = perspective.order_points(box)

    # midpoints of opposing edges

    (tl, tr, br, bl) = box
    (tltrX, tltrY) = midpoint(tl, tr)
    (blbrX, blbrY) = midpoint(bl, br)
    (tlblX, tlblY) = midpoint(tl, bl)
    (trbrX, trbrY) = midpoint(tr, br)

    # distances in pixels
    dA = dist.euclidean((tltrX, tltrY), (blbrX, blbrY))
    dB = dist.euclidean((tlblX, tlblY), (trbrX, trbrY))

    objects.append({
        "box": box,
        "dims": (dA, dB),
        "midpoints": (tltrX, tltrY, blbrX, blbrY, tlblX, tlblY, trbrX, trbrY)
    })

if not objects:
    print("No valid objects found!")
    sys.exit(0)

# pick coin as the smallest (by area)
coin_obj = min(objects, key=lambda o: o["dims"][0] * o["dims"][1])
coin_w, coin_l = coin_obj["dims"]

width_modifier = coin_w / dime_diameter
length_modifier = coin_l / dime_diameter

# draw results
orig = cv2.imread(args["image"])
if orig.shape[0] > orig.shape[1]:
    orig = cv2.rotate(orig, cv2.ROTATE_90_COUNTERCLOCKWISE)
    print("Rotated original image")


for obj in objects:
    (tltrX, tltrY, blbrX, blbrY, tlblX, tlblY, trbrX, trbrY) = obj["midpoints"]
    (dA, dB) = obj["dims"]

    # corrected dimensions in inches
    corrected_w = dA / width_modifier
    corrected_h = dB / length_modifier

    # draw box
    cv2.drawContours(orig, [obj["box"].astype("int")], -1, (0, 255, 0), 2)

    # draw corner points
    for (x, y) in obj["box"]:
        cv2.circle(orig, (int(x), int(y)), 5, (0, 0, 255), -1)

    # draw measurement lines
    cv2.line(orig, (int(tltrX), int(tltrY)), (int(blbrX), int(blbrY)), (255, 0, 255), 2)
    cv2.line(orig, (int(tlblX), int(tlblY)), (int(trbrX), int(trbrY)), (255, 0, 255), 2)

    # add dimensions text
    cv2.putText(orig, "{:.2f} in".format(corrected_h),
                (int(tltrX - 15), int(tltrY - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    cv2.putText(orig, "{:.2f} in".format(corrected_w),
                (int(trbrX + 10), int(trbrY)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

# show result
cv2.imshow("Measured Image", orig)
cv2.waitKey(0)
cv2.destroyAllWindows()
