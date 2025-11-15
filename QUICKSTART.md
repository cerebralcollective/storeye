# Quick Start Guide

## 5-Minute Setup

### Prerequisites
- AWS account with permissions to create S3, Lambda, DynamoDB, API Gateway, Cognito
- AWS CLI and CDK v2 installed
- Node.js 16+ and Python 3.9+
- Existing S3 bucket and DynamoDB table already created

### Step 1: Clone and Install (1 min)

```bash
cd /path/to/StorEye
npm install
npm run cdk:install
npm run frontend:install
```

### Step 2: Configure and Deploy Infrastructure (3 min)

```bash
# Set environment variables for your existing resources
export DATA_BUCKET_NAME="your-bucket-with-json-files"
export TABLE_NAME="DocumentTracker"
export AWS_REGION="us-east-2"

# Deploy CDK
cd cdk
npm run build
cdk bootstrap
cdk deploy
```

**Save the CDK outputs!** You'll need:
- WebsiteUrl
- ApiUrl
- UserPoolId
- UserPoolClientId

### Step 3: Deploy Frontend (1 min)

```bash
cd ../frontend
npm run build

# Get the WebBucketName from CDK outputs above
./scripts/deploy-frontend.sh <WebBucketName>
```

### Step 4: Access the App

Open the `WebsiteUrl` from CDK outputs in your browser. Sign up with an email, confirm it, and log in.

## Local Development

### Frontend Dev Server

```bash
cd frontend

# Create .env file with CDK outputs
cat > .env << EOF
VITE_API_URL=<ApiUrl from CDK>
VITE_USER_POOL_ID=<UserPoolId from CDK>
VITE_USER_POOL_CLIENT_ID=<UserPoolClientId from CDK>
VITE_AWS_REGION=us-east-2
EOF

npm run dev
# Opens http://localhost:5173
```

### Lambda Local Testing

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r lambda/requirements.txt

export BUCKET_NAME="your-bucket-with-json-files"
export TABLE_NAME="DocumentTracker"

# Test reading a document from S3
python lambda/local_test.py get "path/to/your/document.json"

# Test updating a document
python lambda/local_test.py update "doc-id-123" '{"status":"reviewed"}'
```

## Troubleshooting

### Issue: "User is not authenticated"
**Solution:** Make sure you've signed up and confirmed your email in Cognito User Pool

### Issue: "Lambda execution role not found"
**Solution:** Run `cdk deploy` again; IAM roles may need time to propagate

### Issue: "Cannot read from S3"
**Solution:** Verify the Lambda execution role has read access to your data bucket

## Common Tasks

### Add a New Document to S3

```bash
aws s3 cp my-document.json s3://your-bucket/path/to/my-document.json
```

### Create a Test Document in DynamoDB

```bash
aws dynamodb put-item \
  --table-name DocumentTracker \
  --item '{"docId":{"S":"test-doc-1"},"s3Key":{"S":"path/to/my-document.json"}}'
```

### View API Logs

```bash
# Find your API ID
API_ID=$(aws apigateway get-rest-apis --query 'items[0].id' --output text)

# View CloudWatch logs
aws logs tail /aws/lambda/DocumentStack-GetDocFunction* --follow
```

### Update Frontend Only

If you only update the React code:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<WebBucketName>/ --delete
```

## Project Structure at a Glance

```
.
├── cdk/                 # AWS CDK infrastructure
│   ├── lib/
│   │   └── document-stack.ts  # Main stack definition
│   └── bin/
│       └── storeye-cdk.ts      # CDK app entry
├── lambda/              # Python Lambda handlers
│   ├── get_doc.py       # Read from S3
│   ├── update_doc.py    # Update DynamoDB
│   ├── local_test.py    # Local testing
│   └── requirements.txt
├── frontend/            # React + Vite app
│   ├── src/
│   │   ├── App.tsx      # Main app
│   │   ├── Login.tsx    # Cognito auth
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── .env.example
├── scripts/             # Helper scripts
│   ├── build-cdk.sh
│   ├── deploy-frontend.sh
│   └── export-cdk-outputs.sh
├── README.md           # Full documentation
└── ARCHITECTURE.md     # Architecture details
```

## Need Help?

1. Check README.md for detailed instructions
2. Check ARCHITECTURE.md for design decisions
3. Review CloudWatch logs for Lambda errors
4. Check CloudFormation console for stack events
5. Verify IAM roles have correct permissions
