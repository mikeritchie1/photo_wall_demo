# Photo Wall

> **Demo version.** This is a sanitised copy of the private repo with all personal data, real API credentials, and live service connections removed. It's intended to show the structure and code rather than the running product.

A browser-based screensaver / ambient display for your personal photo library. Point it at your Google Photos collection and it turns any screen into a living photo wall — photos drift past as polaroids hanging from fairy lights, filterable by person, date, and album.

## Demo

Photos drift continuously up the screen in two or three columns, each one swaying gently and bobbing as if hanging from a real string. Clicking any photo cycles it to the next image. Controls appear on click and auto-hide after a few seconds.

## How it works

The front-end is a single HTML/JS/CSS page with no framework and no build step. It fetches a `manifest.json` file that describes every photo — path, date, caption, and who's in it — then cycles through them using `requestAnimationFrame`, wrapping photos back into view as they scroll off-screen.

Photos themselves are served from Cloudflare R2 (cloud object storage with a public URL). The front-end detects whether it's running locally or deployed and switches the image base URL accordingly, so local development reads from the `images/` folder while production reads from R2.

## Google Photos metadata

The included `build_manifest.py` script reads Google Takeout exports and extracts the sidecar `.json` files that Google Photos attaches to every image. These sidecars contain:

- **People tags** — names of people Google has identified or you've tagged in the photo
- **Descriptions** — any caption you've written in Google Photos
- **Photo taken time** — the original capture timestamp

This metadata feeds directly into the manifest and powers the filter panel:

- **Filter by person** — select one or more people to show only photos they appear in, or select a named group (e.g. "Friends") to filter by everyone in that group at once
- **Filter by year range** — drag a dual-handle slider to narrow photos to a date range derived from EXIF or Google's timestamp
- **Filter by album** — browse a specific folder/album or view everything at once
- **Caption modes** — show Google Photos descriptions, album names, dates, or nothing

## Customisation

The wall appearance is fully configurable at runtime: photo size, scroll speed, sway intensity, 2 or 3 column layout, light bulb colour (warm, cool, red, blue, green, rainbow), string colour, and background scene. Backgrounds — space, forest, sunset, cityscape, mountains, clouds, galaxy, desert, aurora — are all drawn on canvas with no external assets.
