import {
  CfnOutput,
  Stack,
  StackProps,
  Expiration,
  Duration,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecspatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import path = require("path");

export class WebotBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webotTable = new dynamodb.Table(this, "WeBotTable", {
      tableName: "WeBot",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const webotBucket = new s3.Bucket(this, "WebotBucket", {
      bucketName: "webot-asset-bucket",
      versioned: true,
      publicReadAccess: true,
      accessControl: s3.BucketAccessControl.PUBLIC_READ,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const distribution = new cloudfront.Distribution(
      this,
      "WebotDistribution",
      {
        defaultBehavior: {
          origin: new origins.S3Origin(webotBucket),
        },
      }
    );

    const userPool = new cognito.UserPool(this, "WeBotUserPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        username: true,
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
        profilePicture: {
          required: false,
          mutable: true,
        },
      },
    });

    const userPoolClient = new cognito.UserPoolClient(
      this,
      "WeBotUserPoolClient",
      {
        userPool,
      }
    );

    const api = new apigw.RestApi(this, "webotApi", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
      deploy: true,
    });

    const lambdalayer = new lambda.LayerVersion(this, "WebotLambdaLayer", {
      code: lambda.Code.fromAsset("lambdalayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
    });

    const createUserLambda = new lambda.Function(this, "createUserLambda", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("functions/createUser"),
      handler: "index.handler",
      timeout: Duration.seconds(10),
    });
    webotTable.grantFullAccess(createUserLambda);
    createUserLambda.addEnvironment("TABLE_NAME", webotTable.tableName);
    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      createUserLambda
    );

    const uploadFileLambda = new lambda.Function(this, "UploadFileLambda", {
      code: lambda.Code.fromAsset("functions/uploadFile"),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_16_X,
      layers: [lambdalayer],
    });
    webotBucket.grantPut(uploadFileLambda);

    const uploadFile = api.root.addResource("upload");
    const getAllItemsIntegration = new apigw.LambdaIntegration(
      uploadFileLambda
    );
    uploadFile.addMethod("POST", getAllItemsIntegration, {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // const bus = new events.EventBus(this, "WebotEventBus", {
    //   eventBusName: "WebotEventBus",
    // });

    // const vpc = new ec2.Vpc(this, "WebotVpc", {
    //   maxAzs: 3,
    // });

    // const cluster = new ecs.Cluster(this, "WebotCluster", {
    //   vpc: vpc,
    // });

    // const fargate = new ecspatterns.ApplicationLoadBalancedFargateService(
    //   this,
    //   "WebotFargateService",
    //   {
    //     cluster: cluster,
    //     cpu: 512,
    //     desiredCount: 1,
    //     taskImageOptions: {
    //       image: ecs.ContainerImage.fromAsset("webot-bots"),
    //       environment: {
    //         EVENT_BUS_NAME: bus.eventBusName,
    //         region: process.env.CDK_DEFAULT_REGION!,
    //       },
    //     },
    //     assignPublicIp: false,
    //     memoryLimitMiB: 2048,
    //   }
    // );

    // bus.grantPutEventsTo(fargate.taskDefinition.taskRole);

    // const ebEndpoint = vpc.addInterfaceEndpoint("EbInterfaceEndpoint", {
    //   service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS,
    // });

    // ebEndpoint.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     principals: [new iam.AnyPrincipal()],
    //     actions: ["events:PutEvents"],
    //     resources: [bus.eventBusArn],
    //     conditions: {
    //       ArnEquals: {
    //         "aws:PrincipalArn": `${fargate.taskDefinition.taskRole.roleArn}`,
    //       },
    //     },
    //   })
    // );

    // const webotApi = new appsync.GraphqlApi(this, "WebotApi", {
    //   name: "WebotApi",
    //   schema: appsync.SchemaFile.fromAsset("graphql/schema.graphql"),
    //   authorizationConfig: {
    //     defaultAuthorization: {
    //       authorizationType: appsync.AuthorizationType.API_KEY,
    //       apiKeyConfig: {
    //         expires: Expiration.after(Duration.days(30)),
    //       },
    //     },
    //   },
    // });

    // const lambdalayer = new lambda.LayerVersion(this, "WebotLambdaLayer", {
    //   code: lambda.Code.fromAsset("lambdalayer"),
    //   compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
    // })

    // const processEventLambda = new lambda.Function(this, "ProcessEventLambda", {
    //   code: lambda.Code.fromAsset("functions/processEvent"),
    //   handler: "index.handler",
    //   runtime: lambda.Runtime.NODEJS_16_X,
    //   layers: [lambdalayer],
    //   environment: {
    //     APPSYNC_API_URL: webotApi.graphqlUrl,
    //     APPSYNC_API_KEY: webotApi.apiKey!
    //   },
    // });
    // webotApi.grant(
    //   processEventLambda,
    //   appsync.IamResource.ofType("Mutation"),
    //   "appsync:GraphQL"
    // );

    // const sendEventDataSource = webotApi.addNoneDataSource(
    //   "sendEventDataSource",
    //   {
    //     name: "sendEventDataSource",
    //     description: "Does not save incoming data anywhere",
    //   }
    // );

    // sendEventDataSource.createResolver("SendEventResolver", {
    //   typeName: "Mutation",
    //   fieldName: "sendEvent",
    //   requestMappingTemplate: appsync.MappingTemplate.fromString(`{
    //     "event": $util.toJson($context.arguments)
    //     }`),
    //   responseMappingTemplate: appsync.MappingTemplate.fromString(
    //     "$util.toJson($context.result)"
    //   ),
    // });

    // const eventRule = new events.Rule(this, "BotEventRule", {
    //   eventBus: bus,
    //   targets: [new targets.LambdaFunction(processEventLambda)],
    //   description:
    //     "Send all events from fargate container to processEvent lambda",
    //   eventPattern: {
    //     source: ["tvbot"],
    //   },
    // });
  }
}
