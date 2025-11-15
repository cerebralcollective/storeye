#!/bin/bash
# Quick build script for CDK

cd cdk
echo "Installing dependencies..."
npm install

echo "Building TypeScript..."
npm run build

echo "Synthesizing CloudFormation template..."
npm run synth

echo "Build complete!"
