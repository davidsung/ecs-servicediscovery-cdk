import * as path from 'path';
import * as api from '@aws-cdk/aws-apigatewayv2';
import * as integration from '@aws-cdk/aws-apigatewayv2-integrations';
import * as ec2 from '@aws-cdk/aws-ec2';
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import * as ecs from '@aws-cdk/aws-ecs';
import * as lambda from '@aws-cdk/aws-lambda';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { App, CfnOutput, Construct, Stack, StackProps } from '@aws-cdk/core';

interface EcsServiceDiscoveryStackProps extends StackProps {
  NAMESPACE_NAME: string;
  NODEJS_PORT: number;
}

export class ECSServiceDiscoveryStack extends Stack {
  constructor(scope: Construct, id: string, props: EcsServiceDiscoveryStackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'Vpc');

    // Cloud Map Namespace
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'PrivateDnsNamespace', {
      name: props.NAMESPACE_NAME,
      vpc,
    });

    // Create a ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // Add capacity to it
    cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
      instanceType: new ec2.InstanceType('t3.large'),
      desiredCapacity: 1,
    });

    // Create a Task Definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
      networkMode: ecs.NetworkMode.AWS_VPC,
    });

    const container = taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(
        new DockerImageAsset(this, 'DockerImageAsset', {
          directory: path.join(__dirname, 'healthcheck'),
        })),
      memoryLimitMiB: 512,
    });
    container.addPortMappings({
      containerPort: props.NODEJS_PORT,
      hostPort: props.NODEJS_PORT,
      protocol: ecs.Protocol.TCP,
    });

    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', { vpc });

    const taskSg = new ec2.SecurityGroup(this, 'TaskSecurityGroup', { vpc });
    taskSg.addIngressRule(lambdaSg, ec2.Port.tcp(props.NODEJS_PORT));

    // Instantiate an Amazon ECS Service
    const ec2Service = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
      securityGroups: [taskSg],
      cloudMapOptions: {
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
      },
    });

    const lambdaFn = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
      securityGroup: lambdaSg,
      environment: {
        ...(ec2Service.cloudMapService && {
          HEALTHCHECK_HOSTNAME: ec2Service.cloudMapService.serviceName + '.' + props.NAMESPACE_NAME,
        }),
        HEALTHCHECK_PORT: String(props.NODEJS_PORT),
      },
    });

    const lambdaFnIntegration = new integration.LambdaProxyIntegration({ handler: lambdaFn });

    const httpApi = new api.HttpApi(this, 'HttpApi');

    httpApi.addRoutes({
      path: '/',
      methods: [api.HttpMethod.GET],
      integration: lambdaFnIntegration,
    });

    new CfnOutput(this, 'ApiEndpoint', { value: httpApi.apiEndpoint });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new ECSServiceDiscoveryStack(app, 'ecs-servicediscovery-stack-dev', {
  env: devEnv,
  NAMESPACE_NAME: app.node.tryGetContext('namespace') || 'ecsservicediscoverystack.local',
  NODEJS_PORT: 3000,
});

app.synth();
