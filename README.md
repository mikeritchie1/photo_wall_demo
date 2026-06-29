# Photo Wall

> **Demo version.** This is a sanitised copy of the private repo with all personal data, real API credentials, and live service connections removed. It's intended to show the structure and code rather than the running product.

A browser-based screensaver for your personal photo library. Point it at your Google Photos collection and it turns any screen into a living photo wall - photos drift past as polaroids hanging from fairy lights, filterable by person, date, and album.

## What it does

Photos float up the screen in two or three columns, swaying gently as if hanging from a real string. Clicking any photo skips it to the next one. The controls panel slides in on click and hides itself after a few seconds.

## How it works

It's a single HTML/JS/CSS page with no framework or build step. It reads a `manifest.json` that describes every photo (path, date, caption, who's in it), then cycles through them with `requestAnimationFrame`, wrapping photos back into view as they scroll off screen.

Photos are served from Cloudflare R2. The app detects whether it's running locally or deployed and switches the image source accordingly - local runs read from the `images/` folder, deployed reads from R2.

## Google Photos metadata

The `build_manifest.py` script reads a Google Takeout export and pulls the sidecar `.json` files that Google attaches to each image. Those sidecars include people tags, captions, and the original capture timestamp.

All of that feeds into the filter panel:

- **People** - filter to photos containing a specific person, or pick a named group (e.g. "Friends") to filter by everyone in it at once
- **Year range** - dual slider to narrow by date, pulled from EXIF or Google's timestamp
- **Album** - browse a specific folder or view everything
- **Captions** - show Google Photos descriptions, album name, date, or nothing

## Customisation

Photo size, scroll speed, sway amount, 2 or 3 column layout, light colour (warm, cool, red, blue, green, rainbow), string colour, and background scene are all adjustable at runtime. The background scenes (space, forest, sunset, cityscape, mountains, clouds, galaxy, desert, aurora) are drawn on canvas so there are no external image assets.
