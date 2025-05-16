import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class f1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Dynamo ---------------------------
    const sessionsRacesTable = new dynamodb.Table(this, 'F1RacesTable', {
      tableName: process.env.TABLE_NAME || '',
      partitionKey: {
        name: 'session_key',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambdas ---------------------------
    const getRacesF1 = new NodejsFunction(this, 'getRacesF1', {
      functionName: 'f1-getRacesF1',
      runtime: Runtime.NODEJS_LATEST,
      timeout: cdk.Duration.seconds(30),
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/getRacesF1.ts'),
      environment: {
        API_SESSIONS: process.env.API_SESSIONS || '',
        TABLE_NAME: sessionsRacesTable.tableName,
        STATE_MACHINE_ARN: process.env.STATE_MACHINE_ARN || '',
      },
    });

    sessionsRacesTable.grantReadWriteData(getRacesF1);

    const mamF1 = new NodejsFunction(this, 'getDataOpenF1', {
      functionName: 'f1-mamF1',
      runtime: Runtime.NODEJS_LATEST,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/getDataOpenF1.ts'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        API_DRIVERS: process.env.API_DRIVERS || '',
        API_POSITION: process.env.API_POSITION || '',
        API_SESSIONS: process.env.API_SESSIONS || '',
        BUCKET_NAME: process.env.BUCKET_NAME || '',
      },
    });

    // Cloudwatch ---------------------------
    const cronRaces = new events.Rule(this, 'CloudWatchDailyAt3AMRule', {
      schedule: events.Schedule.expression('cron(0 3 * * ? *)'),
    });
    cronRaces.addTarget(new targets.LambdaFunction(getRacesF1));

    const cronPositions = new events.Rule(this, 'CloudWatchEveryMinuteRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    cronPositions.addTarget(new targets.LambdaFunction(mamF1));

    // Permitir que la Lambda de co
    const cloudwatchPolicy = new iam.PolicyStatement({
      actions: [
        'events:EnableRule',
        'events:DisableRule',
        'events:DescribeRule',
      ],
      resources: ['*'],
    });

    const controlLambda = new NodejsFunction(this, 'ControlLambda', {
      functionName: 'f1-controlLambda',
      runtime: Runtime.NODEJS_LATEST,
      timeout: cdk.Duration.seconds(30),
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/controlLambda.ts'),
      environment: {
        RULE_NAME: cronPositions.ruleName,
      },
    });

    controlLambda.addToRolePolicy(cloudwatchPolicy);

    // Step Functions ----------

    // Step 1
    const waitTime1 = new sfn.Wait(this, 'Wait 3 hour before race', {
      time: sfn.WaitTime.timestampPath('$.waitTime1'),
    });
    // Step 2
    const activeTask = new tasks.LambdaInvoke(this, 'activeTask', {
      lambdaFunction: controlLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'enable',
        session_key: sfn.JsonPath.stringAt('$.session_key'),
        match_start: sfn.JsonPath.stringAt('$.match_start'),
        waitTime1: sfn.JsonPath.stringAt('$.waitTime1'),
        waitTime2: sfn.JsonPath.stringAt('$.waitTime2'),
      }),
      outputPath: '$.Payload',
    });
    // Step 3
    const waitTime2 = new sfn.Wait(this, 'Wait 3 hour after race', {
      time: sfn.WaitTime.timestampPath('$.waitTime2'),
    });
    // Step 4
    const desactiveTask = new tasks.LambdaInvoke(this, 'desactiveTask', {
      lambdaFunction: controlLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'disable',
        session_key: sfn.JsonPath.stringAt('$.session_key'),
        match_start: sfn.JsonPath.stringAt('$.match_start'),
        waitTime1: sfn.JsonPath.stringAt('$.waitTime1'),
        waitTime2: sfn.JsonPath.stringAt('$.waitTime2'),
      }),
      outputPath: '$.Payload',
    });

    const definition = waitTime1 // esperar el dia de la carrera
      .next(activeTask) // activar cloudwatch de un minuto
      .next(waitTime2) // Una hora despues del final de la carrera
      .next(desactiveTask); // Desactivar  cloudwatch de un minuto

    const stepFunction = new sfn.StateMachine(this, 'racesF1', {
      stateMachineName: 'f1-sessions',
      definition,
      timeout: cdk.Duration.days(365),
    });

    stepFunction.grantStartExecution(getRacesF1);

    const bucketName = process.env.BUCKET_NAME || '';

    const bucket = s3.Bucket.fromBucketName(this, 'DataBucket', bucketName);

    bucket.grantWrite(mamF1);

    mamF1.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [`${bucket.bucketArn}/*`],
        effect: iam.Effect.ALLOW,
      })
    );

    getRacesF1.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['states:StopExecution'],
        resources: [
          'arn:aws:states:us-east-1:295402955636:stateMachine:f1-sessions:*',
        ],
        effect: iam.Effect.ALLOW,
      })
    );
  }
}
