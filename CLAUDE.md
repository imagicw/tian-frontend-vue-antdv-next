# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `tian-frontend-vue-antdv-next` — the **next-generation** frontend for 国泰华盛 (Guotai Huasheng)'s 盛天事业部信息系统 (Tian System), a pnpm monorepo fork of [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) v5.7 (Vue 3 + Ant Design Vue). It is a sibling/successor project to `../tian-frontend-vue` (see `../CLAUDE.md` for the broader repo layout of the full Tian System: backend `gths-admin`, reference projects `ruoyi-vue-pro-master` / `yudao-ui-admin-vben-master`, legacy `w-account-frontend`).

Unlike the older `tian-frontend-vue`, this monorepo ships a **single app**, `apps/web-antdv-next`, rather than multiple UI-library flavors — everything else (packages, internal tooling) follows the same vben-admin structure.

## Common Commands

```bash
pnpm install                # Install deps (pnpm >= 11.0.0 enforced via preinstall hook)
pnpm dev:antdv-next          # Start dev server for apps/web-antdv-next (port 8001, see .env.development)
pnpm build:antdv-next        # Production build of apps/web-antdv-next
pnpm lint                    # Run linters (vsh lint: eslint + oxlint + stylelint)
pnpm format                  # Format code (vsh lint --format)
pnpm check:type              # TypeScript type-check across all packages (turbo run typecheck)
pnpm check                   # Full check: circular deps + dep check + type check + cspell
pnpm test:unit                # Run unit tests (vitest --dom, happy-dom environment)
pnpm test:e2e                 # Run e2e tests (turbo run test:e2e, playwright)
```

Run a single unit test file with `pnpm vitest run <path-to-spec>` (or `pnpm vitest <pattern>` in watch mode) from the repo root — vitest config (`vitest.config.ts`) excludes `e2e/`, `dist/`, and lint config files.

Node: `^22.18.0 || ^24.0.0` (`.node-version` pins `24.16.0`). Use `pnpm`, not `npm`/`yarn` — enforced by `preinstall`.

## Architecture

### Monorepo layout
```
apps/web-antdv-next/    # The only app — main web application
packages/
├── @core/               # Core framework packages (base, ui-kit, forward)
├── effects/             # Effect plugins (plugins, hooks, layouts, etc.)
├── constants/           # Shared constants
├── icons/               # Icon definitions
├── locales/             # i18n
├── preferences/         # App preferences
├── stores/              # Pinia stores
├── styles/              # Global styles (Tailwind CSS 4)
├── types/                # Shared TypeScript types
└── utils/                # Utility functions
internal/                # Internal tools (lint configs, tsconfig, vite-config, node-utils)
docs/                     # VitePress docs site (upstream vben-admin docs, mostly generic)
```

### Key directories in `apps/web-antdv-next/src/`
```
router/routes/modules/   # Route definitions per domain (dashboard, dorm, bpm, finance, shipment, ai, infra, system, leave)
views/                   # Page components — mirrors router modules, plus erp/mp/report/wms/_core
api/                     # Backend API service modules, one subdirectory per domain
adapter/                 # Adapter/layout configuration
components/              # Shared components
```

Custom (Tian-specific) business domains live under `views/dorm`, `views/bpm`, `views/finance`, `views/shipment`. Everything else (`system`, `infra`, `ai`, `mp`, `erp`, `wms`, `report`) largely follows the upstream yudao/vben reference pages.

### Cross-domain context maps

Some business domains keep a `CONTEXT.md` alongside their views, documenting domain terminology and cross-domain relationships (see `CONTEXT-MAP.md` at repo root for the index):
- `apps/web-antdv-next/src/views/dorm/CONTEXT.md` — 宿舍管理 (dormitory allocation: 区域/楼栋/房间/床位, 住宿申请与订单, 排房与调房, 部门费用分摊)
- `apps/web-antdv-next/src/views/bpm/CONTEXT.md` — BPM 工作流 (process definitions/instances, approval tasks, business-form rendering)

These two domains are coupled: dormitory applications flow through a BPM process instance for approval; the BPM process definition's `formCustomViewPath` points at a read-only dorm-domain component (e.g. `dorm/apply/modules/process-detail.vue`), linked via `businessKey`/`businessFormData`. BPM does not understand dorm-specific fields — it only dispatches rendering to the dorm domain's registered component. Read the relevant `CONTEXT.md` before making cross-domain changes, and keep it in sync if domain terminology or relationships change.

### Modal + Table pattern (CRITICAL)

Same convention as upstream vben-admin: `<FormModal />` and `<Grid />` (or the page's list component) must be **siblings**, not nested. Wrong: `<FormModal><Grid /></FormModal>`. Right: `<FormModal /><Grid />`. Modals are declared via `useVbenModal({ connectedComponent: ... })` and driven imperatively (`formModalApi.open()` / `.setData()`), not through slot content.

### Backend integration

- Dev server proxies `/admin-api` (see `apps/web-antdv-next/.env.development`, `VITE_GLOB_API_URL=/admin-api`); dev backend base is `http://127.0.0.1:8080`.
- Tenant mode is enabled by default (`VITE_APP_TENANT_ENABLE=true`, default tenant id `1`).
- API request/response encryption is enabled by default (`VITE_APP_API_ENCRYPT_ENABLE=true`, AES, header `X-Api-Encrypt`) — relevant when debugging raw network payloads.
- Backend is the `gths-admin` Spring Boot / yudao-framework project (sibling directory `../gths-admin`); see its own `CONTEXT.md` files for domain definitions from the backend side.

## Conventions

- Commit messages: conventional commits via `czg`/`cz-git` (`pnpm commit`), enforced by commitlint + lefthook.
- i18n: keys should be added consistently across locale namespaces under `packages/locales`.
