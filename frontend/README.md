Frontend (Vite + React + TypeScript)

Run locally

1. Install dependencies

```bash
cd frontend
npm install
```

2. Set environment variables (optional)

If you want to talk to a deployed backend, set these from your CDK outputs:

```bash
export VITE_API_URL="<ApiUrl>/api"
export VITE_USER_POOL_ID="<UserPoolId>"
export VITE_USER_POOL_CLIENT_ID="<UserPoolClientId>"
export VITE_AWS_REGION="us-east-2"
```

3. Start dev server

```bash
npm run dev
```

Notes
- The app includes three primary views: Signup, Login, and Document Viewer.
- If `VITE_API_URL` is not set, the Document Viewer will load local sample data from `src/sampledata/result_bda_blueprint.json` so you can iterate on the UI without the backend.
Frontend (Vite + React)

Local dev

1. cd frontend
2. npm install
3. copy `.env.example` to `.env` and set VITE_API_URL
4. npm run dev

Build for production

1. export VITE_API_URL="https://your-api..."
2. npm run build
