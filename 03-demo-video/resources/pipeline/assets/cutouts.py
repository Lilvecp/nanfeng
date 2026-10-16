"""Team portraits without their backgrounds, for the team scene of the pitch cut (src/pitch/Team.tsx).

The photos are the web app's (04-source-code/web/public/team/*.jpg). Vicente's was taken under a
university sign that the frame cut in half; on its own background the sign stays. The matte comes
from MODNet (portrait matting, ONNX, about 25 MB), run locally:

    curl -L -o .models/modnet.onnx https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx
    .venv-tts/bin/pip install onnxruntime numpy
    .venv-tts/bin/python assets/cutouts.py .models/modnet.onnx

Writes public/team/<name>.png (800×800 RGBA). Image IO goes through ffmpeg.
"""
import pathlib
import subprocess
import sys

import numpy as np
import onnxruntime as ort

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHOTOS = ROOT.parent.parent.parent / "04-source-code" / "web" / "public" / "team"
OUT = ROOT / "public" / "team"
SIZE = 800

# Bits of the background the matte kept: (x0, y0, x1, y1) boxes, in pixels of the 800×800 photo.
CLEAN = {
    "camilo": [(655, 0, 800, 615), (700, 0, 800, 800)],  # the person sitting next to him
}


def read(path, w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}:flags=lanczos",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def main(model):
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    name_in = sess.get_inputs()[0].name
    OUT.mkdir(parents=True, exist_ok=True)
    for photo in sorted(PHOTOS.glob("*.jpg")):
        name = photo.stem
        img = read(photo, SIZE, SIZE)
        x = read(photo, 512, 512).astype(np.float32) / 255.0
        x = ((x - 0.5) / 0.5).transpose(2, 0, 1)[None]
        matte = (np.clip(sess.run(None, {name_in: x})[0][0, 0], 0, 1) * 255).astype(np.uint8)
        up = subprocess.run(["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", "512x512", "-i", "-",
                             "-vf", f"scale={SIZE}:{SIZE}:flags=bicubic", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                            input=matte.tobytes(), capture_output=True, check=True).stdout
        alpha = np.frombuffer(up, np.uint8).reshape(SIZE, SIZE).copy()
        for x0, y0, x1, y1 in CLEAN.get(name, []):
            alpha[y0:y1, x0:x1] = 0
        img = img.copy()
        img[alpha == 0] = 0  # nothing to keep under a clear pixel: a smaller PNG
        rgba = np.dstack([img, alpha])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{SIZE}x{SIZE}", "-i", "-",
                        "-compression_level", "9", str(OUT / f"{name}.png")], input=rgba.tobytes(), check=True)
        print(name, f"{(alpha > 128).mean():.0%} of the frame kept")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / ".models" / "modnet.onnx"))
