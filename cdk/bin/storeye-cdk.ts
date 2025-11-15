#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocumentStack } from '../lib/document-stack';

const app = new cdk.App();

// Read environment variables for existing resources and configuration
const dataBucketName = process.env.DATA_BUCKET_NAME || 'storeye-documents';
const tableName = process.env.TABLE_NAME || 'DocumentTracker';
const whitelistedEmails = process.env.WHITELISTED_EMAILS || 'admin@example.com,user@example.com';

new DocumentStack(app, 'DocumentStack', {
  dataBucketName,
  tableName,
  whitelistedEmails,
});
