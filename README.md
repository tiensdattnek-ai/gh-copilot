# gh-copilot - Simple Basic

Simple, basic, clean Copilot Chat using GitHub PAT + Copilot API directly with SSE streaming.

## Features
- Login with GitHub PAT (ghp_)
- Direct Copilot API: `api.github.com/copilot_internal/v2/token` + `api.githubcopilot.com/chat/completions`
- Streaming SSE
- Simple UI, no colors, fast
- Cloudflare Pages ready with Functions proxy

## Deploy Cloudflare Pages
1. Push this repo to GitHub (gh-copilot)
2. Cloudflare Dashboard > Pages > Create > Connect to Git > select gh-copilot
3. Build settings: Framework None, Build command empty, Output dir `/`
4. Deploy

Or drag & drop:
- Go to Pages > Direct Upload > drop this folder

## Local dev
```
npx wrangler pages dev . --port 8788
```

## Security
- PAT only stored in localStorage
- Use `/api/*` proxy on Pages to avoid CORS
