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

## Multi-User Accounts

This app now supports business-level user accounts in-app:

- A business owner signs up from `/signup`.
- The owner is created with role `owner`.
- Owner/admin users can create additional `employee` and `admin` users from **User Access**.
- Users sign in through `/login`.

### Roles

- `owner`: business creator, full access.
- `admin`: secondary admin, can create users.
- `employee`: standard user.

## DynamoDB Setup (Your Side)

The app now stores auth data in DynamoDB through Vercel serverless APIs.

### 1. Create the table

In AWS DynamoDB, create one table:

- Table name: `OliveOpsAuth` (or your choice)
- Partition key: `PK` (String)
- Sort key: `SK` (String)
- Billing: On-demand (recommended to start)

No GSI is required for this current implementation.

### 2. Create AWS credentials for Vercel

Create an IAM user with programmatic access and permissions limited to this table.

Minimum policy actions:

- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:Query`
- `dynamodb:TransactWriteItems`

Scope these to your table ARN.

### 3. Add Vercel environment variables

In your Vercel project, go to Settings -> Environment Variables and add:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DDB_TABLE_NAME` (example: `OliveOpsAuth`)
- `JWT_SECRET` (long random string)

Add them for Production (and Preview/Development if needed), then redeploy.

### 4. Local development notes

The auth APIs are in `api/` and are served by Vercel runtime.

- `npm run dev` starts Vite only on `http://localhost:5174`
- `npm run dev:full` starts the app plus API routes on `http://localhost:5173`
- If you see stale port conflicts, stop the extra Node processes first or rerun `npm run dev:full` in a clean terminal session

### 5. Data model used in the table

Examples of stored items:

- Business profile
  - `PK = BUSINESS#<businessId>`
  - `SK = PROFILE`
- User record
  - `PK = BUSINESS#<businessId>`
  - `SK = USER#<userId>`
- Global email lookup
  - `PK = EMAIL#<normalizedEmail>`
  - `SK = USER`

This model enforces unique email and supports listing users by business.
