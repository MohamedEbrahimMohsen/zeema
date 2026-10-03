# @zeema/landing

The public marketing landing page, served as its own tiny service on its own port so it
scales and caches independently of the app. It is a single static HTML file
(`public/index.html`) with inline CSS and JS — no framework, no build step.

The only dynamic part is where the **Open Canvas** and **Get started** buttons send
visitors: the running canvas app. That origin differs per environment, so it is injected
from `CANVAS_URL` at startup in place of the `__CANVAS_URL__` placeholder in the page.

## Run it

```bash
pnpm --filter @zeema/landing dev
```

Then open `http://localhost:4000`. Point the buttons elsewhere with `CANVAS_URL`:

```bash
CANVAS_URL=https://canvas.zeema.io LANDING_PORT=4000 pnpm --filter @zeema/landing dev
```

| Variable | Default | Meaning |
|---|---|---|
| `LANDING_PORT` | `4000` | Port to listen on |
| `LANDING_BIND` | `0.0.0.0` | Interface to bind |
| `CANVAS_URL` | `http://localhost:3000` | Origin of every link into the app, and of the design thumbnails |
| `CANVAS_API_URL` | `CANVAS_URL` | Where this server fetches live numbers from, when the app is reachable from here under another address |

Under compose the service is `landing`; `CANVAS_URL` there defaults to `APP_ORIGIN`.

## Live numbers

At startup and every ten minutes the server reads the catalogue (`/api/v1/catalogue`) and the
public design list (`/api/v1/designs`) and fills in the catalogue counts and each design card's
component, edge and finding counts. The catalogue counts baked into the page are the fallback;
a design card whose numbers could not be fetched shows none.

## Test

`pnpm --filter @zeema/landing test` checks every YAML fragment on the page (`data-yaml`)
against the engine and the catalogue on disk, and the claims the page makes about them.
