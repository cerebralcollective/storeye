"""
Unified document handler Lambda function
Handles both GET and POST requests for /doc endpoint
- GET /doc: retrieve documents by docId or s3Key
- POST /doc: update document metadata in DynamoDB

Notes:
- API Gateway handles CORS and Content-Type for static file serving; the Lambda
  should not add CORS response headers itself when API Gateway is configured with
  preflight options. For API responses we keep headers minimal and let API
  Gateway manage CORS.
"""

import json
import os
import base64
import boto3
from botocore.exceptions import ClientError
from typing import Any, Dict

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

BUCKET_NAME = os.environ.get('BUCKET_NAME')
TABLE_NAME = os.environ.get('TABLE_NAME')

if not BUCKET_NAME or not TABLE_NAME:
    raise RuntimeError('Environment variables BUCKET_NAME and TABLE_NAME must be set')

# Get the DynamoDB table
table = dynamodb.Table(TABLE_NAME)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main handler that routes requests based on HTTP method."""
    http_method = (event.get('httpMethod') or '').upper()
    print(f"Incoming request method={http_method} path={event.get('path')} query={event.get('queryStringParameters')}")

    try:
        if http_method == 'GET':
            return handle_get_request(event)
        elif http_method == 'POST':
            return handle_post_request(event)
        else:
            return error_response(405, f'Method {http_method} not allowed')
    except Exception as e:
        print(f'Unhandled error: {e}', flush=True)
        return error_response(500, 'Internal server error')


def handle_get_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle GET /doc requests to retrieve documents.

    Query parameters:
        - docId: document ID (required)
        - s3Key: S3 key override (optional)
    """
    query_params = event.get('queryStringParameters') or {}
    doc_id = (query_params.get('docId') if query_params else None)
    s3_key = (query_params.get('s3Key') if query_params else None) or doc_id

    if not doc_id:
        return error_response(400, 'Missing required parameter: docId')
    if not s3_key:
        return error_response(400, 'Missing required parameter: s3Key or docId')

    try:
        # Get the object from S3
        resp = s3_client.get_object(Bucket=BUCKET_NAME, Key=s3_key)
        body_bytes = resp['Body'].read()
        content_type = resp.get('ContentType') or 'application/octet-stream'

        # Try to fetch DynamoDB metadata (non-fatal)
        metadata = {}
        try:
            md_resp = table.get_item(Key={'docId': doc_id})
            metadata = md_resp.get('Item', {})
        except Exception as e:
            print(f'Warning: failed to read metadata for docId={doc_id}: {e}')

        # If JSON, return structured JSON response
        if content_type.startswith('application/json'):
            try:
                parsed = json.loads(body_bytes.decode('utf-8'))
                payload = {
                    'docId': doc_id,
                    's3Key': s3_key,
                    'document': parsed,
                    'metadata': metadata,
                }
                return json_response(200, payload)
            except Exception:
                # Fall through to returning raw bytes if parsing fails
                pass

        # For non-JSON content, return base64-encoded body and set Content-Type
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': content_type,
            },
            'isBase64Encoded': True,
            'body': base64.b64encode(body_bytes).decode('utf-8'),
        }

    except ClientError as e:
        code = e.response.get('Error', {}).get('Code')
        if code in ('NoSuchKey', '404', 'NotFound'):
            return error_response(404, f'Document not found: {s3_key}')
        print(f'S3 ClientError getting {s3_key}: {e}')
        return error_response(500, 'Failed to retrieve document from S3')
    except Exception as e:
        print(f'Unexpected error in GET: {e}')
        return error_response(500, 'Failed to retrieve document')


def handle_post_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle POST /doc requests to update document metadata in DynamoDB."""
    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        if not isinstance(body, dict):
            return error_response(400, 'Request body must be a JSON object')

        doc_id = body.get('docId')
        updates = body.get('updates', {})

        if not doc_id:
            return error_response(400, 'Missing required field: docId')
        if not updates or not isinstance(updates, dict):
            return error_response(400, 'Missing required field: updates')

        validated = validate_update_values(updates)
        if not validated:
            return error_response(400, 'No valid updates provided')

        # Build safe UpdateExpression using ExpressionAttributeNames / Values
        expr_parts = []
        expr_attr_names = {}
        expr_attr_values = {}
        for idx, (k, v) in enumerate(validated.items()):
            name_placeholder = f'#k{idx}'
            val_placeholder = f':v{idx}'
            expr_parts.append(f"{name_placeholder} = {val_placeholder}")
            expr_attr_names[name_placeholder] = k
            expr_attr_values[val_placeholder] = v

        update_expression = 'SET ' + ', '.join(expr_parts)

        resp = table.update_item(
            Key={'docId': doc_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expr_attr_names,
            ExpressionAttributeValues=expr_attr_values,
            ReturnValues='ALL_NEW',
        )

        updated_item = resp.get('Attributes', {})
        return json_response(200, {
            'message': 'Document metadata updated successfully',
            'docId': doc_id,
            'updated': validated,
            'item': updated_item,
        })

    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body')
    except ClientError as e:
        print(f'DynamoDB ClientError: {e}')
        return error_response(500, 'Failed to update metadata')
    except Exception as e:
        print(f'Unexpected error in POST: {e}')
        return error_response(500, 'Failed to update document')


def validate_update_values(updates: Dict[str, Any]) -> Dict[str, Any]:
    """Validate update values are supported by DynamoDB and filter unsupported types."""
    validated: Dict[str, Any] = {}
    for key, value in updates.items():
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            validated[key] = value
        elif isinstance(value, list):
            if all(isinstance(item, (str, int, float, bool)) for item in value):
                validated[key] = value
            else:
                print(f'Warning: Skipping list {key} with non-scalar items')
        elif isinstance(value, dict):
            if all(isinstance(v, (str, int, float, bool)) for v in value.values()):
                validated[key] = value
            else:
                print(f'Warning: Skipping map {key} with non-scalar values')
        else:
            print(f'Warning: Skipping {key} with unsupported type {type(value).__name__}')
    return validated


def json_response(status: int, payload: Any) -> Dict[str, Any]:
    """Return a JSON API Gateway Lambda proxy response without CORS headers (API Gateway manages CORS)."""
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(payload),
    }


def error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Format an error response (no CORS header; API Gateway handles CORS)."""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'error': message}),
    }
