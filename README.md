# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Vercel Login Configuration

The admin login now validates credentials server-side using a Vercel Serverless Function at `api/login.js`.

Set these environment variables in your Vercel project:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

### Vercel steps

1. Open your Vercel project.
2. Go to **Settings → Environment Variables**.
3. Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` for Production (and Preview if needed).
4. Redeploy.

### Local testing note

When running `npm run dev` (Vite only), `/api/login` is not served.
Use `vercel dev` to test the login API locally, or deploy to Vercel to test full auth flow.

For convenience, this project includes a dev-only fallback login when `/api/login` is unavailable.

- `VITE_DEV_ADMIN_USERNAME` (default: `admin`)
- `VITE_DEV_ADMIN_PASSWORD` (default: `lyvflow123`)

Create a `.env.local` file for custom local credentials:

```env
VITE_DEV_ADMIN_USERNAME=admin
VITE_DEV_ADMIN_PASSWORD=lyvflow123
```
