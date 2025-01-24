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

export class f1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Dynamo ---------------------------
    const raceTable = new dynamodb.Table(this, 'F1RacesTable', {
      partitionKey: {
        name: 'session_key',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Solo para entornos de desarrollo
    });

    // Lambdas ---------------------------

    const getRacesF1 = new NodejsFunction(this, 'getRacesF1', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/getRacesF1.ts'),
      environment: {
        API_SESSIONS: process.env.API_SESSIONS || '',
        TABLE_NAME: raceTable.tableName,
        STATE_MACHINE_ARN: process.env.STATE_MACHINE_ARN || '',
      },
    });

    raceTable.grantReadWriteData(getRacesF1);

    const openF1Lambda = new NodejsFunction(this, 'getDataOpenF1', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/getDataOpenF1.ts'),
      timeout: cdk.Duration.minutes(10),
      environment: {
        API_DRIVERS: process.env.API_DRIVERS || '',
        API_POSITION: process.env.API_POSITION || '',
        API_SESSIONS: process.env.API_SESSIONS || '',
        BUCKET_NAME: process.env.BUCKET_NAME || '',
      },
    });

    // Cloudwatch ---------------------------

    const cronRaces = new events.Rule(this, 'CloudWatchEveryDayRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(2)),
    });
    cronRaces.addTarget(new targets.LambdaFunction(getRacesF1));

    const cronPositions = new events.Rule(this, 'CloudWatchEveryMinuteRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    cronPositions.addTarget(new targets.LambdaFunction(openF1Lambda));

    // Permitir que la Lambda de co
    const cloudwatchPolicy = new iam.PolicyStatement({
      actions: ['cloudwatchevents:EnableRule', 'cloudwatchevents:DisableRule'],
      resources: ['*'],
    });

    const controlLambda = new NodejsFunction(this, 'ControlLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/controlLambda.ts'),
      environment: {
        RULE_NAME: cronPositions.ruleName,
      },
    });

    // Agrega la política a la función Lambda
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
      definition,
      timeout: cdk.Duration.days(365),
    });

    // Permisos para que la lambda listenBucket dispare la Step Function
    stepFunction.grantStartExecution(getRacesF1);
  }
}

// Cron cloudwatch cada 48 horas / 7 dias

// Lambda sessions

// Crea el step function de cada carrera y registra en Dynamo.
// Step function se dispará el dia de la qualifying/sprint/race
// el step fucntion en el dia de la carrera se activa una hora antes y dispara el cron cloudwatch cada 1 min
// se apaga una hora despues de la hora de finalizado

// step fuction de cada minuto dispara la lambda getDataOpen con las posiciones
// las guarda en un json en un S3
