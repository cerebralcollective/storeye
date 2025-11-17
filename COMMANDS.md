# Command Reference - Copy & Paste Ready

## Prerequisites Check

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Verify CDK installation
cdk --version

# Verify Node.js
node --version

# Verify Python
python3 --version

# List existing resources
aws s3 ls | grep your-bucket-name
aws dynamodb list-tables
```

## Step 1: Environment Variables Setup

```bash
# Replace with your actual values
export DATA_BUCKET_NAME="existing-s3-bucket"
export TABLE_NAME="DocumentTracker"
export AWS_REGION="us-east-2"
```

## Step 2: Install Dependencies

```bash
# From repo root
cd /path/to/StorEye

# Install workspace root
npm install

# Install CDK dependencies
cd cdk
npm install
npm run build
cd ..

# Install frontend dependencies
cd frontend
npm install
rm -rf node_modules/.vite
npm run dev
cd ..
```

## Step 3: Bootstrap CDK (One-Time Setup)

```bash
cd cdk
cdk bootstrap
cd ..
```

## Step 4: Deploy Infrastructure

```bash
cd cdk
npm run build
cdk deploy --require-approval never
cd ..
```

**When deployment completes, note these outputs:**
- WebsiteUrl
- ApiUrl
- UserPoolId
- UserPoolClientId
- WebBucketName

Save them in a file or terminal for next steps.

## Step 5: Extract CDK Outputs to Environment

```bash
export API_URL="https://abc123.execute-api.us-east-2.amazonaws.com/prod"
export USER_POOL_ID="us-east-2_abc123xyz"
export USER_POOL_CLIENT_ID="1a2b3c4d5e6f7g8h9i0j"
export WEB_BUCKET_NAME="documentstack-webbucket12345-abcdef"

# Option 2: Using helper script (with jq installed)
eval "$(./scripts/export-cdk-outputs.sh)"
```

## Step 6: Build Frontend

```bash
cd frontend

# Create .env file
cat > .env << EOF
VITE_API_URL=$API_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_AWS_REGION=$AWS_REGION
EOF

# Build
npm run build

cd ..
```

## Step 7: Deploy Frontend to S3

```bash
./scripts/deploy-frontend.sh $WEB_BUCKET_NAME
```

Or manually:

```bash
cd frontend
aws s3 sync dist/ s3://$WEB_BUCKET_NAME/ --delete
cd ..
```

## Step 8: Verify Deployment

```bash
# Open in browser
open "$WEBSITE_URL"

# Or with curl
curl -I "$WEBSITE_URL"
```

## Test Data Setup (Optional)

### Create Test Document in S3

```bash
# Create test JSON
cat > /tmp/test-doc.json << 'EOF'
{
  "title": "Sample Document",
  "status": "active",
  "metadata": {
    "author": "Test User",
    "created": "2025-01-01"
  }
}
EOF

# Upload to S3
aws s3 cp /tmp/test-doc.json s3://$DATA_BUCKET_NAME/test-doc.json
```

### Create Test Document Record in DynamoDB

```bash
aws dynamodb put-item \
  --table-name $TABLE_NAME \
  --item '{
    "docId": {"S": "doc-001"},
    "s3Key": {"S": "test-doc.json"},
    "status": {"S": "active"}
  }'
```

### Query DynamoDB

```bash
aws dynamodb get-item \
  --table-name $TABLE_NAME \
  --key '{"docId": {"S": "doc-001"}}'

aws dynamodb scan \
  --table-name $TABLE_NAME
```

## Local Development

### Frontend Dev Server

```bash
cd frontend

# Create .env for local dev (same as before)
cat > .env << EOF
VITE_API_URL=$API_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_AWS_REGION=$AWS_REGION
EOF

# Start dev server
npm run dev

# Browser will open to http://localhost:5173
```

### Lambda Local Testing

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r lambda/requirements.txt

# Set environment
export BUCKET_NAME=$DATA_BUCKET_NAME
export TABLE_NAME=$TABLE_NAME

# Test get with s3Key
python lambda/local_test.py get test-doc.json

# Test get with docId (requires docId in DynamoDB)
python lambda/local_test.py get_by_doc doc-001

# Test update
python lambda/local_test.py update doc-001 '{"status":"reviewed"}'

# Deactivate virtualenv when done
deactivate
```

## Monitoring and Debugging

### View Lambda Logs

```bash
# Get latest logs
aws logs tail /aws/lambda/DocumentStack-GetDocFunction --follow
aws logs tail /aws/lambda/DocumentStack-UpdateDocFunction --follow

# View specific log group
aws logs describe-log-groups | grep Document
```

### View API Gateway Logs

```bash
# Get API ID
API_ID=$(aws apigateway get-rest-apis --query 'items[0].id' --output text)

# Describe API
aws apigateway get-rest-api --rest-api-id $API_ID

# View stages
aws apigateway get-stages --rest-api-id $API_ID
```

### Check S3 Buckets

```bash
# List objects in data bucket
aws s3 ls s3://$DATA_BUCKET_NAME/ --recursive

# List objects in web bucket
aws s3 ls s3://$WEB_BUCKET_NAME/ --recursive

# Check bucket permissions
aws s3api get-bucket-acl --bucket $WEB_BUCKET_NAME
```

## Cleanup

### Destroy Everything

```bash
# Destroy CDK stack
cd cdk
cdk destroy

# Delete S3 web bucket contents (if not deleted by CDK)
aws s3 rm s3://$WEB_BUCKET_NAME --recursive
```

### Delete Specific Resources

```bash
# Delete Lambda function
aws lambda delete-function --function-name DocumentStack-GetDocFunction

# Delete Cognito User Pool
aws cognito-idp delete-user-pool --user-pool-id $USER_POOL_ID
```

## Troubleshooting Commands

### Check Stack Status

```bash
cd cdk
cdk status
aws cloudformation describe-stacks --stack-name DocumentStack
aws cloudformation describe-stack-events --stack-name DocumentStack
```

### Validate IAM Permissions

```bash
# Check if principal can describe S3 bucket
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::$DATA_BUCKET_NAME

# Check Lambda execution role
aws iam get-role --role-name DocumentStack-LambdaRole
aws iam list-attached-role-policies --role-name DocumentStack-LambdaRole
```

### Test API Directly

```bash
# Get ID token from Cognito (need to set up separately)
# Then call API directly
curl -X GET "$API_URL/doc?docId=doc-001" \
  -H "Authorization: $ID_TOKEN" \
  -H "Content-Type: application/json"

# Or test locally without auth (if CORS allows)
curl -X GET "http://localhost:5173/api/doc?docId=doc-001"
```

### Validate TypeScript/JavaScript

```bash
# Check CDK TypeScript
cd cdk
npx tsc --noEmit

# Check Frontend TypeScript  
cd frontend
npx tsc --noEmit
```

## Performance Optimization Commands

```bash
# Enable Lambda Insights
aws lambda update-function-configuration \
  --function-name DocumentStack-GetDocFunction \
  --layers arn:aws:lambda:us-east-2:580254703988:layer:LambdaInsightsExtension:14


## Cost Monitoring

```bash
# Get estimated costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-02 \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE

# Or use AWS Cost Explorer in console
# https://console.aws.amazon.com/cost-management/
```

## Common Combinations

### Full Fresh Deploy (from scratch)

```bash
export DATA_BUCKET_NAME="my-bucket"
export TABLE_NAME="DocumentTracker"
export AWS_REGION="us-east-2"

cd /path/to/StorEye

# Install all
npm install && cd cdk && npm install && cd ../frontend && npm install && cd ..

# Deploy
cd cdk && npm run build && cdk bootstrap && cdk deploy --require-approval never && cd ..

# Note CDK outputs and set them
export API_URL="https://..."
export USER_POOL_ID="..."
export USER_POOL_CLIENT_ID="..."
export WEB_BUCKET_NAME="..."

# Build and deploy frontend
cd frontend && npm run build && cd ..
./scripts/deploy-frontend.sh $WEB_BUCKET_NAME

# Done! Open $WEBSITE_URL in browser
```

### Quick Frontend Update

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://$WEB_BUCKET_NAME/ --delete
```

### Quick Test After Deploy

```bash
# Test Lambda locally
python3 -m venv .venv
source .venv/bin/activate
pip install -r lambda/requirements.txt
export BUCKET_NAME=$DATA_BUCKET_NAME
export TABLE_NAME=$TABLE_NAME
python lambda/local_test.py get_by_doc doc-001
deactivate

# Test frontend
cd frontend
npm run dev  # Visit http://localhost:5173
```
