#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { f1Stack } from '../lib/stacks/f1Stack';
import { getAppConfig } from './getAppConfig';

// Set deployment environment
const appConfig = getAppConfig();
const apiName: string = 'Json_F1' + appConfig.deploymentEnv;
console.log('apiName: ', apiName);

const app = new cdk.App();
new f1Stack(app, 'f1Stack', {});
