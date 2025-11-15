# Architecture Diagrams & Visual Guides
```text
┌──────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│                                                              │
│  Route: GET /doc  ┐                                          │
│                   ├─→ DocHandlerFunction (Lambda)            │
│  Route: POST /doc ┘      ├─→ handle_get_request()            │
│                          │    ├─→ S3.get_object()            │
│                          │    └─→ DynamoDB.get_item()        │
│                          │                                   │
│                          ├─→ handle_post_request()           │
│                          │    └─→ DynamoDB.update_item()     │
│                          │                                   │
│                          └─→ (Shared execution context)      │
│                                                              │
│  Route: /api/                                                │
│  ├─→ S3 AwsIntegration → index.html                          │
│                                                              │
│  Route: /api/{proxy+}                                        │
│  ├─→ S3 AwsIntegration → {proxy}                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

# HTTP Request Flow Diagram

## Request Flow for GET /doc

```
User Browser
    │
    ├─→ [1] Cognito Login
    │        │
    │        └─→ Cognito User Pool
    │             └─→ ID Token (JWT)
    │
    ├─→ [2] Fetch /doc?docId=123
    │        Headers: Authorization: Bearer <token>
    │        │
    │        └─→ API Gateway
    │             │
    │             ├─→ Check CORS preflight (OPTIONS)
    │             │    └─→ Return CORS headers
    │             │
    │             ├─→ Validate Cognito auth
    │             │    └─→ Check token is valid
    │             │
    │             ├─→ Route to GET /doc
    │             │    └─→ Invoke DocHandlerFunction
    │                      │
    │                      └─→ Lambda: handle_get_request(event)
    │                           ├─→ Parse query params
    │                           │    ├─→ docId = "123"
    │                           │    └─→ s3Key = "123" (default)
    │                           │
    │                           ├─→ S3.get_object(Bucket, Key="123")
    │                           │    └─→ Parse JSON content
    │                           │
    │                           ├─→ DynamoDB.get_item(docId="123")
    │                           │    └─→ Fetch metadata
    │                           │
    │                           └─→ Return response:
    │                                {
    │                                  docId: "123",
    │                                  s3Key: "123",
    │                                  document: {...},
    │                                  metadata: {...}
    │                                }
    │
    └─← API Gateway (with CORS headers)
         │
         └─← Browser
              └─→ Response rendered in app
```

## Request Flow for POST /doc

```
User Browser (authenticated)
    │
    ├─→ Fetch /doc (POST)
    │   Body: {"docId": "123", "updates": {...}}
    │   Headers: Authorization: Bearer <token>
    │   │
    │   └─→ API Gateway
    │        │
    │        ├─→ Check CORS preflight (OPTIONS)
    │        │    └─→ Return CORS headers
    │        │
    │        ├─→ Validate Cognito auth
    │        │    └─→ Token valid ✓
    │        │
    │        ├─→ Route to POST /doc
    │        │    └─→ Invoke DocHandlerFunction
    │        │         │
    │        │         └─→ Lambda: handle_post_request(event)
    │        │              ├─→ Parse request body (JSON)
    │        │              │    └─→ docId="123", updates={...}
    │        │              │
    │        │              ├─→ Validate updates
    │        │              │    ├─→ Check types (scalars/lists/maps)
    │        │              │    └─→ Filter invalid types
    │        │              │
    │        │              ├─→ Build DynamoDB UpdateExpression
    │        │              │    └─→ "SET status = :status, ..."
    │        │              │
    │        │              ├─→ DynamoDB.update_item(
    │        │              │      Key={docId: "123"},
    │        │              │      UpdateExpression=...,
    │        │              │      ExpressionAttributeValues=...
    │        │              │    )
    │        │              │
    │        │              └─→ Return response:
    │        │                   {
    │        │                     message: "Updated successfully",
    │        │                     docId: "123",
    │        │                     updated: {...},
    │        │                     item: {...full updated item...}
    │        │                   }
    │        │
    │        └─← Return 200 OK + response + CORS headers
    │
    └─← Browser
         └─→ Update UI with response
```


# Cold Start Timeline

```
GET /doc request arrives
│
├─ [0ms]   API Gateway receives request
├─ [5ms]   Validates Cognito auth
├─ [10ms]  Routes to DocHandlerFunction
│
├─ [15ms]  ❄️  DocHandlerFunction COLD START
│          Lambda runtime initializes
│          Python interpreter starts
│          boto3 libraries loaded
│          ~500ms total
│
├─ [515ms] Function executes
│          Check HTTP method (1ms)
│          Call handle_get_request() (60ms)
│          S3.get_object() (50ms)
│          DynamoDB.get_item() (50ms)
│          JSON serialization (10ms)
│
└─ [686ms] Response sent to browser

─────────────────────────────────────

POST /doc request arrives (same session)
│
├─ [0ms]   API Gateway receives request
├─ [5ms]   Validates Cognito auth
├─ [10ms]  Routes to DocHandlerFunction
│
├─ [15ms]  ✨ DocHandlerFunction WARM (in cache)
│          No cold start needed!
│          Reuses warm container
│          ~5ms overhead
│
├─ [20ms]  Function executes
│          Check HTTP method (1ms)
│          Call handle_post_request() (70ms)
│          DynamoDB.update_item() (50ms)
│          JSON serialization (10ms)
│
└─ [151ms] Response sent to browser

Total time for GET + POST: 686ms + 151ms = 837ms
Average per request: 418.5ms (similar total, but better distribution)

If multiple requests in same session:
- 1st request (GET): 686ms (cold start)
- 2nd request (POST): 151ms (warm)
- 3rd request (GET): 151ms (warm)
- 4th request (POST): 151ms (warm)
- ...


```

# HTTP Method Routing Logic

```
                         request arrives
                              │
                              ▼
                    Extract HTTP method
                              │
                     ┌────────┴────────┐
                     │                 │
                 GET │                 │ POST
                     │                 │
                     ▼                 ▼
            handle_get_request()    handle_post_request()
                     │                 │
      ┌──────────────┴──────────────┐  │
      │                             │  │
      ▼                             ▼  ▼
   Parse query params        Parse request body
   ├─ docId (required)      ├─ docId (required)
   └─ s3Key (optional)      └─ updates (required)
      │                          │
      ▼                          ▼
   Validate inputs          Validate updates
   ├─ docId exists          ├─ Type check
   └─ s3Key defined         └─ Scalar/list/map only
      │                          │
      ▼                          ▼
   S3 Operations           DynamoDB Operations
   ├─ get_object()         ├─ build_update_expression()
   └─ Handle errors        └─ update_item()
      │                          │
      ▼                          ▼
   DynamoDB Lookup         Build Response
   └─ get_item()           ├─ message
      │                    ├─ docId
      ▼                    ├─ updated
   Build Response          └─ item
   ├─ docId                    │
   ├─ s3Key                    ▼
   ├─ document            Return success_response()
   └─ metadata                 │
      │                        │
      ▼                        │
   Return success_response()   │
      │                        │
      └────────┬───────────────┘
               │
               ▼
         Format with headers:
         ├─ Content-Type: application/json
         └─ Access-Control-Allow-Origin: *
               │
               ▼
         Return to API Gateway
               │
               ▼
         Return to Browser
```

# Deployment Timeline

```
Current State: Code ready
                     │
                     ▼
            [1] Run: cdk deploy
                 Time: ~3-5 minutes
                 ├─ Validate CloudFormation
                 ├─ Create/update resources
                 │  ├─ DocHandlerFunction (NEW)
                 │  ├─ Remove GetDocFunction & UpdateDocFunction (OLD)
                 │  └─ S3 CORS update
                 └─ Output API endpoints
                     │
                     ▼
            [2] Delete old files
                 Time: <1 minute
                 ├─ rm lambda/get_doc.py
                 └─ rm lambda/update_doc.py
                     │
                     ▼
            [3] Deploy frontend
                 Time: ~1-2 minutes
                 ├─ npm run build
                 └─ aws s3 sync dist/ s3://...
                     │
                     ▼
            [4] Run tests
                 Time: ~5 minutes
                 ├─ Test GET /doc
                 ├─ Test POST /doc
                 ├─ Test /api/ frontend
                 ├─ Test CORS
                 └─ Check CloudWatch logs
                     │
                     ▼
            ✅ Production Ready!
                 Total time: 10-15 minutes
```
