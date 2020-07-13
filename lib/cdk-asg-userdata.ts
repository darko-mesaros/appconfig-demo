import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import codecommit = require('@aws-cdk/aws-codecommit');
import codedeploy = require('@aws-cdk/aws-codedeploy');
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipelineactions = require('@aws-cdk/aws-codepipeline-actions');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import elbv2Targets = require('@aws-cdk/aws-elasticloadbalancingv2-targets');
import { InterfaceVpcEndpoint, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService } from '@aws-cdk/aws-ec2';
import { ManagedPolicy } from '@aws-cdk/aws-iam';

// FileSystem access
import fs = require('fs');
import { TopicPolicy } from '@aws-cdk/aws-sns';

export class AppconfigDemoStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // IAM 
    const instanceRole = new iam.Role(this, 'instanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    instanceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2RoleforSSM'))
    // SSM Permissions

    // VPC
    const vpc = new ec2.Vpc(this, 'VPC');

    // Security group
    const webSg = new ec2.SecurityGroup(this, 'WebSG',{
      vpc: vpc,
      allowAllOutbound: true,
      description: "Web Server Security Group"
    });

    webSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), 'Web from anywhere')

    // ASG Configuration

    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(), // get the latest Amazon Linux image
      maxCapacity: 5,
      minCapacity: 1,
      desiredCapacity: 3,
      role: instanceRole
    });

    // Add user Data

    var bootscript:string;
    bootscript = fs.readFileSync('assets/web_userdata.sh','utf8');

    asg.addUserData(bootscript);
    asg.addSecurityGroup(webSg)

    const weblb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true
    });

    const listener = weblb.addListener('Listener', {
      port: 80,
      open: true
    });

    listener.addTargets('WebFleet', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [asg]
    });

    // DevOps

    // CodeCommit
    const webRepo = new codecommit.Repository(this, 'Web Repository' ,{
      repositoryName: 'WebRepository',
      description: 'Web Application Repository -  please add some code.', // optional property
    });

    const webBuild = new codebuild.Project(this, 'MyFirstCodeCommitProject', {
      source: codebuild.Source.codeCommit({repository: webRepo})
    });

    // CodeDeploy

    const webApplication = new codedeploy.ServerApplication(this, 'WebCodeDeployApplication', {
      applicationName: 'WebCodeDeployApplication', // optional property
    });

    const webDeploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'WebCodeDeploymentGroup',{
      application: webApplication,
      deploymentGroupName: 'WebDeploymentGroup',
      autoScalingGroups: [asg],
      installAgent: true
    })

    // Outputs
    const webSourceOutput = new codepipeline.Artifact();
    const webBuildOutput = new codepipeline.Artifact();

    // CodePipeline

    const webPipeline = new codepipeline.Pipeline(this, 'WebServer Pipeline', {
      pipelineName: 'webServerPipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineactions.CodeCommitSourceAction({
              actionName: 'CodeCommit_Source',
              repository: webRepo,
              output: webSourceOutput,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineactions.CodeBuildAction({
              actionName: 'CodeBuild_Build',
              input: webSourceOutput,
              project: webBuild,
              outputs: [webBuildOutput],
            })
          ]
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipelineactions.CodeDeployServerDeployAction({
              actionName: 'CodeDeploy_Deploy',
              deploymentGroup: webDeploymentGroup,
              input: webBuildOutput
            }),
          ],
        }
      ]
    });
  }
}
