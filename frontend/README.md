# DiaInsights frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + react-hook-form + zod.

## Run

The backend must be running first (see `../backend/README.md`):

```powershell
cd ..\backend
venv\Scripts\Activate.ps1
uvicorn api:app --port 8000
```

Then, in a second terminal:

```powershell
cd frontend
npm run dev
```

Open http://localhost:3000.

The dev server is **pinned to port 3000** on purpose. The backend's CORS allow-list
defaults to `http://localhost:3000`, so if Next falls back to another port every
request fails with a CORS error. If you need a different port, set
`ALLOWED_ORIGINS` on the backend to match.

## Configuration

Copy `.env.example` to `.env.local` and adjust if needed:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing it.

## Checks

```powershell
npm run lint          # eslint
npm run build         # production build + type check
npm run check         # lint + contrast + parity + error handling
```

Individual checks:

- `check:contrast` — verifies every foreground/background pair in the palette meets
  WCAG AA. Edit the `:root` block in `src/app/globals.css` and re-run this.
- `check:parity` — guards the two things most likely to drift from the backend:
  BMI banding (`src/lib/bmi.ts` vs the pipeline's `pd.cut` bins) and the request body
  the wizard sends (`toPatientInput` vs `backend/example_request.json`).
- `check:errors` — exercises the 422 / 429 / API-down / 500 branches in `src/lib/api.ts`
  against a mocked fetch.

## Layout

```
src/lib/api.ts         typed client; types mirror backend/api.py exactly
src/lib/schema.ts      zod schema + limits; validates in cm/kg AFTER unit conversion
src/lib/units.ts       cm/kg <-> ft-in/lb
src/lib/bmi.ts         BMI banding, mirrors the pipeline's bins
src/providers/         client-side result state (React context, nothing persisted)
src/components/wizard/ the four steps, review screen, shared field components
```

## Notes for anyone changing this

- **No persistence.** The assessment result is held in React state only. No
  localStorage, no cookies, no analytics. A hard refresh on `/results` therefore
  shows the "start again" state by design — that is the privacy trade-off, not a bug.
- **The backend's 422 responses omit the submitted value** so patient data never
  reaches error logs. All limit validation therefore has to happen in
  `src/lib/schema.ts`, before the request is sent.
- **Never call the score a probability or a diagnosis.** See `../AGENTS.md`.