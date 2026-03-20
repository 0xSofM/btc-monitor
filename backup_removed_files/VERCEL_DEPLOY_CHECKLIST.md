# Vercel Deploy Checklist

## 1. GitHub side

- Confirm the repository default branch is `main`.
- Open `Settings -> Actions -> General`.
- Set `Workflow permissions` to `Read and write permissions`.
- Keep GitHub Actions enabled, because `.github/workflows/update-data.yml` updates the JSON data files and pushes them back to the repo.

## 2. Import project into Vercel

- Create a new project from this GitHub repository.
- In `Settings -> Build and Deployment`, set `Root Directory` to `app`.
- Set `Framework Preset` to `Vite`.
- Set `Build Command` to `npm run build`.
- Set `Output Directory` to `dist`.
- Leave `Install Command` empty or default.
- Set `Production Branch` to `main`.

## 3. Environment variables

- No required environment variables for production.
- Do not set `VITE_API_PROXY_URL` in production unless you intentionally want to override the built-in Vercel proxy route.

## 4. Runtime expectations

- Static history data is served from `/btc_indicators_history.json`.
- Static latest snapshot is served from `/btc_indicators_latest.json`.
- The app now prefers the static latest snapshot in production-style usage and only falls back to the live API when needed.
- Live proxy requests go through `/api/btc-data`.

## 5. First deployment checks

- Open the site home page and confirm the dashboard loads.
- Visit `/btc_indicators_history.json` and confirm the file is accessible.
- Visit `/btc_indicators_latest.json` and confirm the file is accessible.
- Visit `/api/btc-data/latest` and confirm JSON is returned.
- Trigger a manual redeploy once after saving the Vercel settings.

## 6. Ongoing updates

- GitHub Actions updates the JSON files on schedule.
- Each new commit from the workflow triggers a fresh Vercel deployment automatically.
- If the dashboard date stops moving, check:
  - GitHub Actions run status
  - workflow permissions
  - whether the latest workflow commit reached `main`
  - the most recent Vercel deployment logs
