import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class f1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log('test3: ', process.env.API_DRIVERS);

    const openF1Lambda = new NodejsFunction(this, 'getDataOpenF1', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambdas/getDataOpenF1.ts'),
      environment: {
        API_DRIVERS: process.env.API_DRIVERS || '',
        API_POSITION: process.env.API_POSITION || '',
      },
    });

    const rule = new events.Rule(this, 'LambdaEveryMinute', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    rule.addTarget(new targets.LambdaFunction(openF1Lambda));
  }
}
