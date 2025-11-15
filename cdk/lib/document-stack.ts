import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export interface DocumentStackProps extends cdk.StackProps {
    dataBucketName: string;
    tableName: string;
    whitelistedEmails?: string;
}

export class DocumentStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DocumentStackProps) {
        super(scope, id, props);

        const { dataBucketName, tableName, whitelistedEmails = '' } = props;

        // Import existing resources
        const dataBucket = s3.Bucket.fromBucketName(this, 'DataBucket', dataBucketName);

        // Create web bucket for frontend hosting
        // CORS is handled by API Gateway defaultCorsPreflightOptions, not S3
        // S3 website hosting is NOT needed - API Gateway AwsIntegration calls S3 API directly
        const webBucket = new s3.Bucket(this, 'WebBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: false,
        });

        // Create Cognito User Pool
        const userPool = new cognito.UserPool(this, 'DocumentUserPool', {
            userPoolName: 'document-service-pool',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Create Lambda role for Cognito pre-sign-up handler
        const cognitoLambdaRole = new iam.Role(this, 'CognitoLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });
        cognitoLambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );

        // Create pre-sign-up Lambda trigger
        const preSignUpFn = new lambda.Function(this, 'CognitoPreSignUpFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'cognito_presignup.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
            // When the white list gets longer
            // this could be changed to use a DDB table
            // or a json file in S3
            // so the environment variable could either be the table name or S3 path
            environment: {
                WHITELIST_EMAILS: whitelistedEmails,
            },
            role: cognitoLambdaRole,
            timeout: cdk.Duration.seconds(10),
        });

        // Attach pre-sign-up trigger to user pool
        userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUpFn);

        const userPoolClient = userPool.addClient('DocumentClient', {
            userPoolClientName: 'document-web-client',
            generateSecret: false,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        // Create Cognito Authorizer for API Gateway
        const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
            cognitoUserPools: [userPool],
        });

        // Create Lambda execution role
        const lambdaRole = new iam.Role(this, 'LambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });
        lambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );

        // Grant permissions to data bucket and table
        dataBucket.grantRead(lambdaRole);
        const tableArn = cdk.Stack.of(this).formatArn({
            service: 'dynamodb',
            resource: `table/${tableName}`,
        });
        lambdaRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
                resources: [tableArn],
            })
        );

        // Create Lambda function (handles both GET and POST)
        // This single function handles:
        // - GET /doc: retrieve document from S3
        // - POST /doc: update document status/metadata
        const docHandlerFn = new lambda.Function(this, 'DocHandlerFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'doc_handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
            environment: {
                BUCKET_NAME: dataBucketName,
                TABLE_NAME: tableName,
            },
            role: lambdaRole,
            timeout: cdk.Duration.seconds(10),
        });

        // Create REST API Gateway with Cognito authorization
        const api = new apigw.RestApi(this, 'DocumentApi', {
            restApiName: 'Document Service API',
            description: 'API for document retrieval and updates',
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: apigw.Cors.DEFAULT_HEADERS.concat(['Authorization']),
            },
        });

        // Create IAM role for API Gateway to access S3
        const apiGatewayS3Role = new iam.Role(this, 'ApiGatewayS3Role', {
            assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        });
        apiGatewayS3Role.addToPrincipalPolicy(
            new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                resources: [webBucket.arnForObjects('*')],
            })
        );

        // Add /api/* resources to serve frontend through API Gateway S3 integration
        // Using {proxy+} captures both /api/ (empty proxy → index.html) and /api/path
        const apiResource = api.root.addResource('api');
        const proxy = apiResource.addResource('{proxy+}');

        // S3 integration for static files with optional path
        const s3Integration = new apigw.AwsIntegration({
            service: 's3',
            region: cdk.Stack.of(this).region,
            path: `${webBucket.bucketName}/{proxy}`,
            integrationHttpMethod: 'GET',
            options: {
                credentialsRole: apiGatewayS3Role,
                requestParameters: {
                    'integration.request.path.proxy': 'method.request.path.proxy',
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
                        },
                    },
                ],
            },
        });

        // Handle GET /api/ (root) - serve index.html
        apiResource.addMethod('GET', new apigw.AwsIntegration({
            service: 's3',
            region: cdk.Stack.of(this).region,
            path: `${webBucket.bucketName}/index.html`,
            integrationHttpMethod: 'GET',
            options: {
                credentialsRole: apiGatewayS3Role,
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
                        },
                    },
                ],
            },
        }), {
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Content-Type': true,
                    },
                },
            ],
        });

        // Handle GET /api/{proxy+} - serve any file
        proxy.addMethod('GET', s3Integration, {
            requestParameters: {
                'method.request.path.proxy': true,
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Content-Type': true,
                    },
                },
            ],
        });

        // Add bucket policy to restrict S3 access to this specific API Gateway only
        // This ensures the bucket can only be read by the API Gateway service from this specific endpoint
        webBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                sid: 'AllowAPIGatewayRead',
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal('apigateway.amazonaws.com')],
                actions: ['s3:GetObject'],
                resources: [webBucket.arnForObjects('*')],
                conditions: {
                    'ArnLike': {
                        'aws:SourceArn': cdk.Fn.sub(
                            'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/*',
                            {
                                ApiId: api.restApiId,
                            }
                        ),
                    },
                },
            })
        );

        // Add /doc endpoint with Cognito authorization
        // Both GET and POST requests use the same merged docHandlerFn
        const doc = api.root.addResource('doc');
        doc.addMethod('GET', new apigw.LambdaIntegration(docHandlerFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        doc.addMethod('POST', new apigw.LambdaIntegration(docHandlerFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'REST API Gateway URL (access web app at /api/)',
        });
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
            description: 'Cognito User Pool ID',
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
        });
        new cdk.CfnOutput(this, 'WebBucketName', {
            value: webBucket.bucketName,
            description: 'S3 bucket for frontend hosting (served via API Gateway /api/)',
        });
    }
}
