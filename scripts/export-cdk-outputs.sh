#!/bin/bash
# Helper script to extract CDK outputs and export as environment variables

STACK_NAME="${1:-DocumentStack}"

echo "Extracting CDK outputs from stack: $STACK_NAME"

# Get CDK outputs in JSON format
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output json 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "Error: Could not find stack $STACK_NAME"
  exit 1
fi

# Parse outputs and export as environment variables
echo "$OUTPUTS" | jq -r '.[] | "export \(.OutputKey)=\(.OutputValue)"' | while read line; do
  echo "$line"
  eval "$line"
done

echo ""
echo "Environment variables exported. Run this command to apply them:"
echo "eval \"\$(./scripts/export-cdk-outputs.sh)\""
