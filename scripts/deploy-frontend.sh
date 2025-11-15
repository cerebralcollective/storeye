#!/bin/bash
# Frontend deployment script

set -e

WEB_BUCKET="${1}"

if [ -z "$WEB_BUCKET" ]; then
  echo "Usage: ./scripts/deploy-frontend.sh <web-bucket-name>"
  exit 1
fi

echo "Building frontend..."
cd frontend
npm run build

echo "Uploading to S3 bucket: $WEB_BUCKET"
aws s3 sync dist/ s3://$WEB_BUCKET/ --delete

echo "Frontend deployed successfully!"
