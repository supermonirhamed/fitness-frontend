# Fitness Platform — Frontend (Vue 3 + PrimeVue 4)

Staff/admin SPA styled with the **Studio Admin Design System** (Claude Design). Tokens live in `src/styles/tokens/` and are mapped onto PrimeVue's Aura preset in `src/theme/preset.ts`. Arabic (RTL) is the default; English (LTR) is fully supported.

The host decides the app: `fitness.test` → platform console (Super Admin), `{slug}.fitness.test` → that organization.

```bash
npm install
cp .env.example .env
npm run dev          # http://fitness.test:5173 — proxies /api and /sanctum to the Laravel API on :8000
npm run test:unit
npm run type-check && npm run lint
```

See the backend README for `/etc/hosts` entries.
