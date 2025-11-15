"""
Local test harness for lambda handlers.
Usage: set environment variables BUCKET_NAME and TABLE_NAME to point to real resources, then run:
  python local_test.py get <s3Key>
  python local_test.py get_by_doc <docId>
  python local_test.py update <docId> '{"field": "value"}'

This runs the handler functions directly (no AWS Lambda infra required).
"""
import os
import sys
import json

from doc_handler import handler as doc_handler
from typing import Any, Dict


def invoke_get(s3key: str | None = None, docId: str | None = None) -> None:
    event: Dict[str, Any] = {'queryStringParameters': {}}
    if s3key:
        event['queryStringParameters']['s3Key'] = s3key
    if docId:
        event['queryStringParameters']['docId'] = docId
    print('invoking doc_handler (GET)...')
    resp = doc_handler(event, None)
    print(json.dumps(resp, indent=2))


def invoke_update(docId: str, updates: Dict[str, Any]) -> None:
    event: Dict[str, Any] = {'body': json.dumps({'docId': docId, 'updates': updates}), 'isBase64Encoded': False}
    print('invoking doc_handler (POST)...')
    resp = doc_handler(event, None)
    print(json.dumps(resp, indent=2))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('usage: python local_test.py <get|get_by_doc|update> [args]')
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == 'get' and len(sys.argv) >= 3:
        invoke_get(s3key=sys.argv[2])
    elif cmd == 'get_by_doc' and len(sys.argv) >= 3:
        invoke_get(docId=sys.argv[2])
    elif cmd == 'update' and len(sys.argv) >= 4:
        updates = json.loads(sys.argv[3])
        invoke_update(sys.argv[2], updates)
    else:
        print('invalid args')