#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AppconfigDemoStack } from '../lib/appconfig-demo-stack';

const app = new cdk.App();
new AppconfigDemoStack(app, 'AppconfigDemoStack');
