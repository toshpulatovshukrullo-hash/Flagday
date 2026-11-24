"""Veo (Gemini API) orqali image-to-video generatsiya.

Kalit: muhitning Network secrets bo'limida (host generativelanguage.googleapis.com, sarlavha x-goog-api-key) —
proksi uni so'rovga o'zi qo'shadi. Yoki GEMINI_API_KEY muhit o'zgaruvchisi.

  python3 goal_reel/veo.py models                       # mavjud Veo modellarini ko'rsatish
  python3 goal_reel/veo.py gen <kadr.jpg> <prompt.txt> <chiqish.mp4> [model] [n_variant]
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
NEG = ("text, watermark, logos, extra players, distorted limbs, extra fingers, warped faces, cartoon, CGI look, "
       "low resolution, flicker")


def req(url, body=None, raw=False):
    h = {"Content-Type": "application/json"}
    if os.environ.get("GEMINI_API_KEY"):
        h["x-goog-api-key"] = os.environ["GEMINI_API_KEY"]
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(r, timeout=300) as resp:
            b = resp.read()
            return b if raw else json.loads(b)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')[:800]}")


def models():
    out, tok = [], ""
    while True:
        r = req(f"{API}/models?pageSize=200" + (f"&pageToken={tok}" if tok else ""))
        out += [m["name"].split("/")[-1] for m in r.get("models", []) if "veo" in m["name"]]
        tok = r.get("nextPageToken")
        if not tok:
            return out


def generate(image, prompt, out, model=None, n=1):
    model = model or sorted(models())[-1]
    img = base64.b64encode(open(image, "rb").read()).decode()
    body = {
        "instances": [{"prompt": prompt, "image": {"bytesBase64Encoded": img, "mimeType": "image/jpeg"}}],
        "parameters": {"aspectRatio": "9:16", "negativePrompt": NEG, "sampleCount": n,
                       "personGeneration": "allow_adult"},
    }
    op = req(f"{API}/models/{model}:predictLongRunning", body)
    name = op["name"]
    print("model:", model, "| operatsiya:", name, flush=True)
    while not op.get("done"):
        time.sleep(10)
        op = req(f"{API}/{name}")
        print("  kutilmoqda ...", flush=True)
    if "error" in op:
        sys.exit(f"xato: {op['error']}")
    resp = op["response"]
    samples = (resp.get("generateVideoResponse", resp).get("generatedSamples")
               or resp.get("generatedVideos") or [])
    if not samples:
        sys.exit(f"video qaytmadi (filtr?): {json.dumps(resp)[:800]}")
    base, ext = os.path.splitext(out)
    for i, s in enumerate(samples):
        v = s.get("video", s)
        path = out if len(samples) == 1 else f"{base}_v{i + 1}{ext}"
        if v.get("uri"):
            data = req(v["uri"] + ("&" if "?" in v["uri"] else "?") + "alt=media", raw=True)
        else:
            data = base64.b64decode(v["bytesBase64Encoded"])
        open(path, "wb").write(data)
        print("saqlandi:", path, flush=True)


if __name__ == "__main__":
    if sys.argv[1:2] == ["models"]:
        print("\n".join(models()))
    elif sys.argv[1:2] == ["gen"]:
        a = sys.argv[2:]
        generate(a[0], open(a[1]).read().strip(), a[2], a[3] if len(a) > 3 else None, int(a[4]) if len(a) > 4 else 1)
    else:
        print(__doc__)
