from backgroundremover.bg import remove
import cv2
import numpy as np

def remove_bg_with_mask(src_img_path, out_img_path, mask_path):
    model_choices = ["u2net", "u2net_human_seg", "u2netp"]

    # Read image as bytes
    with open(src_img_path, "rb") as f:
        data = f.read()

    # Remove background with alpha matting
    img_bytes = remove(
        data,
        model_name=model_choices[0],
        alpha_matting=True,
        alpha_matting_foreground_threshold=100,   # looser
        alpha_matting_background_threshold=140,    # looser
        alpha_matting_erode_structure_size=5,     # less erosion
        alpha_matting_base_size=1000
    )

    # Save the cut-out result (RGBA -> written directly)
    with open(out_img_path, "wb") as f:
        f.write(img_bytes)

    # Decode result to numpy (so we can extract alpha channel)
    nparr = np.frombuffer(img_bytes, np.uint8)
    rgba = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

    # Extract alpha channel as mask
    if rgba.shape[2] == 4:
        alpha = rgba[:, :, 3]   # 4th channel
        cv2.imwrite(mask_path, alpha)

    print(f"Saved cutout: {out_img_path}")
    print(f"Saved mask:   {mask_path}")



# Example usage
remove_bg_with_mask(
    "assets/example_6.jpg",
    "assets/example_6_rmbg.png",   # keep PNG to preserve transparency
    "assets/example_6_mask.jpg"    # grayscale mask
)
