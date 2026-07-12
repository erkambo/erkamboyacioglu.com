# goose leaderboard api

Cloudflare Worker serving the shared high scores for the goose game.
The site itself stays on GitHub Pages — this is only the scores.

## deploy

```bash
cd worker
npx wrangler login                      # opens a browser, one time
npx wrangler kv namespace create GOOSE  # prints an id
# paste that id into wrangler.toml, then:
npx wrangler deploy
```

Deploy prints a URL like `https://goose.<your-subdomain>.workers.dev`.
Put it in `script.js`:

```js
const API = 'https://goose.your-subdomain.workers.dev';
```

## check it works

```bash
curl https://goose.your-subdomain.workers.dev
# []

curl -X POST https://goose.your-subdomain.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"initials":"ERK","score":12}'
# [{"initials":"ERK","score":12}]
```

## notes

- `ALLOWED_ORIGIN` in `wrangler.toml` restricts which site may call this from a
  browser. Set it to your real domain before going live. (It does not stop curl —
  nothing can — which is why the Worker validates every field itself.)
- Scores above `MAX_PLAUSIBLE_SCORE` (200) are rejected: the board is 15x15, so
  nobody legitimately gets there.
- If the API is unreachable the game silently falls back to per-browser scores,
  so the site never breaks because of this service.
