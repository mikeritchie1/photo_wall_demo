# Photo Wall - GitHub Pages Test Setup

This project is configured to deploy to GitHub Pages via Actions.

## 1. Add one test photo

Place one image at:

`images/demo/test.jpg`

If you use another filename, also update `images/manifest.json`.

## 2. Push to GitHub

```bash
git add .
git commit -m "Setup GitHub Pages deploy"
git push origin main
```

## 3. Enable GitHub Pages

In your GitHub repo:

1. Open `Settings`
2. Open `Pages`
3. Under `Build and deployment`, set `Source` to `GitHub Actions`

After the workflow completes, your site will be live at:

`https://<your-username>.github.io/<repo-name>/`

## Notes

- Current test manifest is demo-only and points to `images/demo/test.jpg`.
- This keeps the first deployment lightweight before adding cloud storage.
