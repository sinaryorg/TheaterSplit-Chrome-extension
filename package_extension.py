import json
import os
import zipfile

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

os.makedirs("dist", exist_ok=True)

with open("manifest.json", "r", encoding="utf-8") as f:
    manifest = json.load(f)

version = manifest["version"]
zip_path = os.path.join("dist", f"TheaterSplit-v{version}.zip")

if os.path.exists(zip_path):
    os.remove(zip_path)

files_to_include = [
    "manifest.json",
    "background.js",
    "content.js",
    "content.css",
    "popup.html",
    "popup.js",
    "popup.css",
    "sinary-logo.svg",
    "LICENSE",
    "PRIVACY_POLICY.md",
]

allowed_icons = {"icon16.png", "icon48.png", "icon128.png", "sinary-icon.png"}

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for file_path in files_to_include:
        if os.path.exists(file_path):
            zf.write(file_path, file_path.replace("\\", "/"))

    if os.path.exists("icons"):
        for root, _, files in os.walk("icons"):
            for file in sorted(files):
                if file in allowed_icons:
                    full_path = os.path.join(root, file)
                    zf.write(full_path, f"icons/{file}")

print(f"Successfully packaged {zip_path}")
with zipfile.ZipFile(zip_path, "r") as zf:
    for name in zf.namelist():
        print(f"  - {name}")
