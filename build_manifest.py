import json
import re
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
except ImportError:
    Image = None

# Project structure assumed:
# your-project/
#   build_manifest.py
#   images/
#     test/
#     holiday/
#     birthday/

PROJECT_ROOT = Path(__file__).parent
IMAGES_DIR = PROJECT_ROOT / "images"
MANIFEST_PATH = IMAGES_DIR / "manifest.json"

# Allowed image file extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def format_file_mtime(file: Path) -> str:
    return datetime.fromtimestamp(file.stat().st_mtime).strftime("%Y-%m-%d")


def parse_exif_datetime(raw_value) -> str | None:
    if not raw_value:
        return None
    if isinstance(raw_value, bytes):
        raw_value = raw_value.decode("utf-8", errors="ignore")
    if not isinstance(raw_value, str):
        return None

    normalized = raw_value.strip().replace("T", " ")
    if len(normalized) >= 19:
        normalized = normalized[:19]

    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_xmp_datetime(raw_value) -> str | None:
    if not raw_value:
        return None
    if isinstance(raw_value, bytes):
        raw_value = raw_value.decode("utf-8", errors="ignore")
    if not isinstance(raw_value, str):
        return None

    # Typical ISO forms from XMP: 2024-05-02T16:59:48 or with timezone.
    match = re.search(r"\d{4}-\d{2}-\d{2}", raw_value)
    if not match:
        return None

    try:
        return datetime.strptime(match.group(0), "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def extract_date_from_exif_mapping(exif_mapping) -> str | None:
    if not exif_mapping:
        return None

    # Most reliable capture-time tags first.
    for tag in (36867, 36868, 306):  # DateTimeOriginal, DateTimeDigitized, DateTime
        parsed = parse_exif_datetime(exif_mapping.get(tag))
        if parsed:
            return parsed
    return None


def get_capture_date(file: Path) -> str:
    if Image is None:
        return format_file_mtime(file)

    try:
        with Image.open(file) as img:
            # Primary EXIF route.
            parsed = extract_date_from_exif_mapping(img.getexif())
            if parsed:
                return parsed

            # Some formats keep EXIF in a raw info blob.
            raw_exif = img.info.get("exif")
            if raw_exif:
                exif_obj = Image.Exif()
                exif_obj.load(raw_exif)
                parsed = extract_date_from_exif_mapping(exif_obj)
                if parsed:
                    return parsed

            # Common metadata keys used by PIL readers for some formats/exporters.
            exif_like_keys = (
                "DateTimeOriginal",
                "DateTimeDigitized",
                "DateTime",
                "date:create",
                "date:modify",
                "creation_time",
            )
            for key in exif_like_keys:
                parsed = parse_exif_datetime(img.info.get(key))
                if parsed:
                    return parsed

            # XMP dates (e.g., xmp:CreateDate / photoshop:DateCreated).
            for key in ("XML:com.adobe.xmp", "xmp", "XMP"):
                parsed = parse_xmp_datetime(img.info.get(key))
                if parsed:
                    return parsed
    except Exception:
        pass

    return format_file_mtime(file)


def build_manifest():
    manifest = {}

    if not IMAGES_DIR.exists():
        print(f"Images folder not found: {IMAGES_DIR}")
        return

    for folder in sorted(IMAGES_DIR.iterdir()):
        if not folder.is_dir():
            continue

        image_files = [
            {
                "filename": file.name,
                "text": "",
                "date": get_capture_date(file),
            }
            for file in sorted(folder.iterdir())
            if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS
        ]

        if image_files:
            manifest[folder.name] = image_files

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Manifest created: {MANIFEST_PATH}")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    build_manifest()
