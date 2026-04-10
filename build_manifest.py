import json
import re
from pathlib import Path
from datetime import datetime, timezone

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pillow_heif
except ImportError:
    pillow_heif = None

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
ROOT_MISC_FOLDER_NAME = "Various"
TARGET_FOLDERS = None
DELETE_ORIGINAL_HEIC = True
DELETE_CONSUMED_SIDECAR_JSON = False

# Allowed image file extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
HEIC_EXTENSIONS = {".heic", ".heif"}


def format_display_date(dt: datetime) -> str:
    day = dt.day
    if 10 <= (day % 100) <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix} {dt.strftime('%B %Y')}"


def format_file_mtime(file: Path) -> str:
    return format_display_date(datetime.fromtimestamp(file.stat().st_mtime))


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
            return format_display_date(datetime.strptime(normalized, fmt))
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
        return format_display_date(datetime.strptime(match.group(0), "%Y-%m-%d"))
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

def converted_heic_path(source_file: Path) -> Path:
    return source_file.with_suffix(".jpg")

def is_targeted_file(file: Path) -> bool:
    try:
        relative = file.relative_to(IMAGES_DIR)
    except ValueError:
        return False
    if len(relative.parts) == 1:
        return TARGET_FOLDERS is None
    if len(relative.parts) < 1:
        return False
    if TARGET_FOLDERS is None:
        return True
    return relative.parts[0] in TARGET_FOLDERS

def load_json_with_fallbacks(path: Path):
    try:
        raw = path.read_bytes()
    except OSError:
        return None

    for encoding in ("utf-8-sig", "utf-8", "utf-16", "cp1252"):
        try:
            return json.loads(raw.decode(encoding))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return None

def get_sidecar_candidates_for_image(image_file: Path):
    stem = image_file.stem
    suffix = image_file.suffix
    return [
        f"{stem}{suffix}".lower(),
        stem.lower(),
        f"{stem}.heic".lower(),
        f"{stem}.heif".lower(),
    ]

def find_matching_sidecars(image_file: Path, sidecar_files):
    candidates = get_sidecar_candidates_for_image(image_file)
    matches = []
    for sidecar in sidecar_files:
        sidecar_name = sidecar.name.lower()
        sidecar_base = sidecar.stem.lower()
        if any(sidecar_name.startswith(candidate) for candidate in candidates):
            matches.append(sidecar)
            continue
        if any(candidate.startswith(sidecar_base) for candidate in candidates):
            matches.append(sidecar)
    return matches

def get_sidecar_metadata(sidecar_files):
    description = ""
    photo_taken = None
    consumed = []

    for sidecar in sidecar_files:
        data = load_json_with_fallbacks(sidecar)
        if not isinstance(data, dict):
            continue

        consumed.append(sidecar)

        raw_description = data.get("description")
        if isinstance(raw_description, str) and raw_description.strip():
            description = raw_description.strip()

        photo_taken_time = data.get("photoTakenTime")
        if isinstance(photo_taken_time, dict):
            timestamp = photo_taken_time.get("timestamp")
            if timestamp is not None:
                try:
                    dt = datetime.fromtimestamp(int(str(timestamp)), timezone.utc)
                    photo_taken = format_display_date(dt)
                except (ValueError, TypeError, OSError, OverflowError):
                    photo_taken = None

            if not photo_taken:
                formatted = photo_taken_time.get("formatted")
                if isinstance(formatted, str) and formatted.strip():
                    formatted = formatted.strip()
                    match = re.search(r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})", formatted)
                    if match:
                        parsed_date = None
                        for fmt in ("%b %d, %Y", "%B %d, %Y"):
                            try:
                                parsed_date = datetime.strptime(match.group(1), fmt)
                                break
                            except ValueError:
                                continue
                        if parsed_date:
                            photo_taken = format_display_date(parsed_date)
                    else:
                        iso_match = re.search(r"\d{4}-\d{2}-\d{2}", formatted)
                        if iso_match:
                            try:
                                parsed_iso = datetime.strptime(iso_match.group(0), "%Y-%m-%d")
                                photo_taken = format_display_date(parsed_iso)
                            except ValueError:
                                photo_taken = None

    return description, photo_taken, consumed

def convert_heic_to_jpg(source_file: Path, target_file: Path) -> bool:
    if Image is None or pillow_heif is None:
        return False

    try:
        with Image.open(source_file) as img:
            exif_bytes = img.info.get("exif")
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            save_kwargs = {"quality": 92}
            if exif_bytes:
                save_kwargs["exif"] = exif_bytes

            img.save(target_file, "JPEG", **save_kwargs)
        return True
    except Exception as error:
        print(f"Failed to convert {source_file}: {error}")
        return False

def ensure_heic_conversions():
    # Migrate older conversion naming (e.g., IMG_1234.heic.jpg -> IMG_1234.jpg).
    for legacy_file in IMAGES_DIR.rglob("*.heic.jpg"):
        if not legacy_file.is_file() or not is_targeted_file(legacy_file):
            continue
        modern_file = legacy_file.with_name(legacy_file.name[: -len(".heic.jpg")] + ".jpg")
        if modern_file.exists():
            continue
        try:
            legacy_file.rename(modern_file)
        except OSError as error:
            print(f"Failed to rename legacy converted file {legacy_file}: {error}")

    heic_files = [
        file
        for file in IMAGES_DIR.rglob("*")
        if file.is_file()
        and file.suffix.lower() in HEIC_EXTENSIONS
        and is_targeted_file(file)
    ]

    if not heic_files:
        return

    if Image is None:
        print("Pillow is not installed. Skipping HEIC conversion.")
        return

    if pillow_heif is None:
        print("pillow-heif is not installed. Skipping HEIC conversion.")
        print("Install it with: pip install pillow-heif")
        return

    pillow_heif.register_heif_opener()

    converted_count = 0
    skipped_count = 0
    deleted_count = 0
    for source_file in heic_files:
        target_file = converted_heic_path(source_file)
        needs_conversion = (
            not target_file.exists()
            or target_file.stat().st_mtime < source_file.stat().st_mtime
        )

        if not needs_conversion:
            skipped_count += 1
            if DELETE_ORIGINAL_HEIC and target_file.exists():
                try:
                    source_file.unlink()
                    deleted_count += 1
                except OSError as error:
                    print(f"Failed to delete original {source_file}: {error}")
            continue

        if convert_heic_to_jpg(source_file, target_file):
            converted_count += 1
            if DELETE_ORIGINAL_HEIC and target_file.exists():
                try:
                    source_file.unlink()
                    deleted_count += 1
                except OSError as error:
                    print(f"Failed to delete original {source_file}: {error}")

    print(
        f"HEIC conversion complete: {converted_count} converted, {skipped_count} up-to-date, {deleted_count} originals deleted."
    )

def move_root_images_to_various_folder():
    if TARGET_FOLDERS is not None and ROOT_MISC_FOLDER_NAME not in TARGET_FOLDERS:
        return

    various_dir = IMAGES_DIR / ROOT_MISC_FOLDER_NAME
    various_dir.mkdir(exist_ok=True)

    moved_count = 0
    skipped_count = 0
    for file in sorted(IMAGES_DIR.iterdir()):
        if not file.is_file():
            continue
        suffix = file.suffix.lower()
        if suffix not in IMAGE_EXTENSIONS and suffix not in HEIC_EXTENSIONS:
            continue

        destination = various_dir / file.name
        if destination.exists():
            skipped_count += 1
            continue

        try:
            file.rename(destination)
            moved_count += 1
        except OSError as error:
            print(f"Failed to move {file} to {destination}: {error}")

    if moved_count or skipped_count:
        print(
            f"Root image move complete: {moved_count} moved to {ROOT_MISC_FOLDER_NAME}, {skipped_count} skipped (already existed)."
        )


def build_manifest():
    manifest = {}

    if not IMAGES_DIR.exists():
        print(f"Images folder not found: {IMAGES_DIR}")
        return

    move_root_images_to_various_folder()
    ensure_heic_conversions()

    # Include images directly inside `images/` under a catch-all folder.
    # This supports sidecar metadata the same way album subfolders do.
    if TARGET_FOLDERS is None:
        root_json_sidecars = [
            file
            for file in sorted(IMAGES_DIR.iterdir())
            if file.is_file()
            and file.suffix.lower() == ".json"
            and file.name.lower() not in {"manifest.json", "metadata.json"}
        ]

        root_consumed_sidecars = set()
        root_image_files = []
        for file in sorted(IMAGES_DIR.iterdir()):
            if not file.is_file() or file.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            if file.name.endswith(".browser.jpg"):
                continue

            sidecar_matches = find_matching_sidecars(file, root_json_sidecars)
            custom_text, taken_time, consumed = get_sidecar_metadata(sidecar_matches)
            for matched_sidecar in sidecar_matches:
                root_consumed_sidecars.add(matched_sidecar)
            for parsed_sidecar in consumed:
                root_consumed_sidecars.add(parsed_sidecar)

            root_image_files.append(
                {
                    "filename": file.name,
                    "path": file.name,
                    "text": custom_text,
                    "date": taken_time or get_capture_date(file),
                }
            )

        if root_image_files:
            manifest[ROOT_MISC_FOLDER_NAME] = root_image_files

        if DELETE_CONSUMED_SIDECAR_JSON:
            for sidecar in sorted(root_consumed_sidecars):
                try:
                    sidecar.unlink()
                except OSError as error:
                    print(f"Failed to delete sidecar {sidecar}: {error}")

    for folder in sorted(IMAGES_DIR.iterdir()):
        if not folder.is_dir():
            continue
        if TARGET_FOLDERS is not None and folder.name not in TARGET_FOLDERS:
            continue

        all_json_sidecars = [
            file
            for file in sorted(folder.iterdir())
            if file.is_file()
            and file.suffix.lower() == ".json"
            and file.name.lower() not in {"manifest.json", "metadata.json"}
        ]

        consumed_sidecars = set()
        image_files = []
        for file in sorted(folder.iterdir()):
            if not file.is_file() or file.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            if file.name.endswith(".browser.jpg"):
                continue

            sidecar_matches = find_matching_sidecars(file, all_json_sidecars)
            custom_text, taken_time, consumed = get_sidecar_metadata(sidecar_matches)
            for matched_sidecar in sidecar_matches:
                consumed_sidecars.add(matched_sidecar)
            for parsed_sidecar in consumed:
                consumed_sidecars.add(parsed_sidecar)

            image_files.append(
                {
                    "filename": file.name,
                    "path": f"{folder.name}/{file.name}",
                    "text": custom_text,
                    "date": taken_time or get_capture_date(file),
                }
            )

        if image_files:
            manifest[folder.name] = image_files

        if DELETE_CONSUMED_SIDECAR_JSON:
            for sidecar in sorted(consumed_sidecars):
                try:
                    sidecar.unlink()
                except OSError as error:
                    print(f"Failed to delete sidecar {sidecar}: {error}")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Manifest created: {MANIFEST_PATH}")
    manifest_preview = json.dumps(manifest, indent=2, ensure_ascii=False)
    try:
        print(manifest_preview)
    except UnicodeEncodeError:
        print(manifest_preview.encode("ascii", errors="replace").decode("ascii"))

if __name__ == "__main__":
    build_manifest()
