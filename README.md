AWS Serverless React Web App with Cognito Authentication

This project provisions AWS infrastructure for a React frontend that securely communicates with Lambda functions via API Gateway with Cognito authentication and whitelisted user signup.

Architecture
- React frontend hosted on S3, served via API Gateway (/api/ endpoint)
- API Gateway with Cognito User Pool authorization
- Lambda functions (Python 3.12) for document retrieval and updates
- Cognito User Pool with pre-sign-up validation for whitelisted emails
- Existing S3 bucket for document data
- Existing DynamoDB table (DocumentTracker) for document metadata

Prerequisites
- Node.js and npm
- AWS CDK v2 installed (npm i -g aws-cdk)
- AWS credentials configured
- Existing S3 bucket containing JSON documents
- Existing DynamoDB table named DocumentTracker with docId partition key

Setup and Deployment

1. Install workspace-level packages (optional):

```bash
npm install
npm run cdk:install
npm run frontend:install
```

2. Configure CDK environment variables for existing resources and whitelisted emails:

```bash
export DATA_BUCKET_NAME="your-existing-s3-bucket"
export TABLE_NAME="DocumentTracker"
export WHITELISTED_EMAILS="admin@example.com,user@example.com"
```

3. Deploy CDK stack (from cdk/ directory):

```bash
cd cdk
npm install
npm run build
cdk bootstrap
cdk deploy
```

4. Note the CDK outputs:
   - ApiUrl: API Gateway endpoint (web app accessible at ApiUrl/api/)
   - UserPoolId: Cognito User Pool ID
   - UserPoolClientId: Cognito User Pool Client ID
   - WebBucketName: S3 bucket for frontend assets

5. Set frontend environment variables:

```bash
export VITE_API_URL="<ApiUrl from CDK>/api"
export VITE_USER_POOL_ID="<UserPoolId from CDK>"
export VITE_USER_POOL_CLIENT_ID="<UserPoolClientId from CDK>"
export VITE_AWS_REGION="us-east-2"  # or your region
```

6. Build and deploy frontend:

```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://<WebBucketName>/
```

7. Visit ApiUrl/api/ in your browser. You will be prompted to sign up (only whitelisted emails allowed).

Local Development

Frontend development server:

```bash
cd frontend
npm install
export VITE_API_URL="<ApiUrl>/api"
export VITE_USER_POOL_ID="<UserPoolId>"
export VITE_USER_POOL_CLIENT_ID="<UserPoolClientId>"
export VITE_AWS_REGION="us-east-2"
npm run dev
```

Lambda local testing:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r lambda/requirements.txt

export BUCKET_NAME="<your-data-bucket>"
export TABLE_NAME="DocumentTracker"

# Test get_doc with S3 key
python lambda/local_test.py get path/to/document.json

# Test get_doc with docId (DDB item must include s3Key attribute)
python lambda/local_test.py get_by_doc some-doc-id

# Test update_doc
python lambda/local_test.py update some-doc-id '{"status":"processed"}'
```

Project Structure

- cdk/: AWS CDK infrastructure (TypeScript)
  - bin/: CDK app entry point
  - lib/: CDK stack definitions
- lambda/: Python Lambda function handlers (Python 3.12)
  - get_doc.py: Retrieves documents from S3 by docId or s3Key
  - update_doc.py: Updates DocumentTracker DynamoDB table
  - cognito_presignup.py: Cognito pre-sign-up trigger for whitelisted users
  - serve_static.py: Serves React frontend files from S3 via API Gateway
  - local_test.py: Local testing harness
  - requirements.txt: Python dependencies
- frontend/: Vite + React + TypeScript web application
  - UI includes Signup, Login, and Document Viewer (DocView component)
  - DocView will fetch document JSON from the API (GET /doc) and render nested JSON
    with "Prove" and "Reject" buttons that POST status updates to /doc.
  - If `VITE_API_URL` is not set in development, DocView falls back to sample data
    in `frontend/src/sampledata/result_bda_blueprint.json` so you can iterate on the
    UI without the backend deployed.
  - src/App.tsx: Main application component
  - src/Login.tsx: Cognito authentication component
  - vite.config.ts: Vite configuration
  - .env.example: Environment variable template

API Endpoints

All `/doc` endpoints require Cognito authentication (Authorization header with ID token).

GET /doc
- Query params: docId (lookup via DDB) or s3Key (direct S3 access)
- Returns: { "doc": { ... } } with nested JSON from S3

POST /doc
- Body: { "docId": "...", "updates": { "field": "value", ... } }
- Updates DocumentTracker DDB table
- Returns: { "status": "updated", "attributes": {...} }

GET /api/ and /api/{path}
- Serves frontend React app from S3
- Automatically serves index.html for SPA routing

Authentication & Whitelisted Signup

The app uses AWS Amplify with Cognito for authentication. Users must:
1. Sign up with an email from the whitelist (WHITELISTED_EMAILS environment variable)
2. Auto-confirm and auto-verify (no email confirmation step needed)
3. Sign in to obtain ID tokens
4. ID tokens are automatically included in API calls

Cognito User Pool Configuration

- Email-based signup and sign-in
- Auto-confirm and auto-verify whitelisted users via pre-sign-up Lambda trigger
- Password requirements: 8+ chars, uppercase, lowercase, digits
- Pre-sign-up Lambda validates email against whitelist

Lambda Runtime

- Python 3.12 for all Lambda functions
- Modern async/await support available
- Latest boto3 compatibility

Notes and Assumptions

- This scaffold focuses on structure. Add production-ready error handling, rate limiting, and additional security (WAF, private subnets, etc.) before production.
- DynamoDB table must exist in the same AWS account and region.
- S3 data bucket must exist and Lambda must have read access.
- Frontend is served via API Gateway (no CloudFront), directly from S3.
- Document JSON must be valid JSON; update operations store values as strings unless extended in update_doc.py.
- Whitelisted emails can be updated by redeploying CDK with new WHITELISTED_EMAILS.

Cleanup

To remove all AWS resources:

```bash
cd cdk
cdk destroy
# Then manually delete:
# - S3 data bucket (if created separately)
# - DynamoDB table (if created separately)
```

Troubleshooting

- "Email not whitelisted": Add your email to WHITELISTED_EMAILS environment variable and redeploy CDK
- "Invalid client id": Check VITE_USER_POOL_CLIENT_ID matches CDK output
- "Unauthorized": Ensure ID token is included in Authorization header (Amplify does this automatically)
- Lambda errors: Check CloudWatch logs in AWS console (CloudWatch > Logs > Lambda function name)
- Frontend not loading: Check S3 bucket contains dist/ files, verify API Gateway has /api/ resource





Notes and assumptions
- The Lambda code is under `lambda/` and uses boto3 available in AWS Lambda runtime.
- This scaffold focuses on structure and wiring. You should add production-ready error handling, input validation, and authentication (e.g., IAM + Cognito or API keys) before deploying to production.

