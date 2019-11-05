const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

AWS.config = new AWS.Config({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACESSKEY,
  secretAccessKey: process.env.AWS_SECRETACCESSKEY,
});

const instanceRules = {
  BlockDeviceMappings: [
    {
      DeviceName: '/dev/sda1',
      Ebs: {
        VolumeSize: 8,
      },
    },
  ],
  ImageId: 'ami-07d0cf3af28718ef8',
  InstanceType: 't2.micro',
  MaxCount: 1,
  MinCount: 1,
};
const data = `#!/bin/bash
apt update -y
apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o /etc/init.d/webserver.sh
chmod +x /etc/init.d/webserver.sh
update-rc.d webserver.sh defaults
update-rc.d webserver.sh enable
`;

const createSecurityGroup = async (ec2, GroupName) => {
  return await ec2
    .createSecurityGroup({
      Description: 'Security Group gerado automaticamente',
      GroupName,
    })
    .promise()
    .then(({ GroupId }) => {
      return GroupId;
    });
};

const authorizeSecurityGroupIngress = async (ec2, GroupId) => {
  console.log(`Autorizando a entrada para o grupo: ${GroupId}`);
  await ec2
    .authorizeSecurityGroupIngress({
      GroupId,
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
        {
          IpProtocol: 'tcp',
          FromPort: 22,
          ToPort: 22,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
      ],
    })
    .promise();
};

(async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });
  const elb = await new AWS.ELB({ apiVersion: '2012-06-01' });
  var elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });
  const groupId = await createSecurityGroup(ec2, process.env.AWS_SECURITYGROUP);
  const groupLBId = await createSecurityGroup(
    ec2,
    process.env.AWS_SECURITYGROUP_ELB
  );

  await authorizeSecurityGroupIngress(ec2, groupId);
  await authorizeSecurityGroupIngress(ec2, groupLBId);
  console.log('Grupo autorizado');
  await ec2
    .createKeyPair({ KeyName: process.env.AWS_KEYNAME })
    .promise()
    .then(async ({ KeyMaterial: data }) => {
      await promisify(fs.writeFile)('aws-key.pem', data);
    });
  const UserData = Buffer.from(data).toString('base64');
  const instanceId = await ec2
    .runInstances({
      ...instanceRules,
      KeyName: process.env.AWS_KEYNAME,
      SecurityGroups: [process.env.AWS_SECURITYGROUP],
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            {
              Key: 'Name',
              Value: 'david-webserver',
            },
          ],
        },
      ],
      UserData,
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0].InstanceId;
    });

  await ec2
    .waitFor('instanceStatusOk', {
      InstanceIds: [instanceId],
    })
    .promise()
    .catch(err => {
      console.log(err, err.stack);
    });
  console.log(`Instância criada com sucesso`);

  const imageId = await ec2
    .createImage({
      BlockDeviceMappings: [
        {
          DeviceName: '/dev/sda1',
          Ebs: {
            VolumeSize: 8,
          },
        },
      ],
      Description: 'Imagem para webserver',
      InstanceId: instanceId,
      Name: process.env.AWS_IMAGENAME,
      NoReboot: true,
    })
    .promise()
    .then(data => {
      return data.ImageId;
    });

  await ec2.waitFor('imageAvailable', { ImageIds: [imageId] });
  await autoscaling
    .createLaunchConfiguration({
      ImageId: imageId,
      InstanceType: 't2.micro',
      LaunchConfigurationName: process.env.AWS_LAUNCHCONFIG,
      SecurityGroups: [groupId],
    })
    .promise();

  await elbv2
    .createTargetGroup({
      Name: process.env.AWS_TARGETGROUP,
      port: 80,
      Protocol: 'HTTP',
      HealthCheckEnabled: true,
      HealthCheckIntervalSeconds: 30,
      HealthCheckPort: '8000',
      HealthCheckProtocol: 'HTTP',
      UnhealthyThresholdCount: 2,
      HealthyThresholdCount: 2,
      HealthCheckPath: '/healthcheck',
      HealthCheckTimeoutSeconds: 2,
    })
    .promise();
  // await elb
  //   .createLoadBalancer({
  //     AvailabilityZones: [process.env.AWS_AVAILABILITY],
  //     Listeners: [
  //       {
  //         InstancePort: 80,
  //         InstanceProtocol: 'HTTP',
  //         LoadBalancerPort: 80,
  //         Protocol: 'HTTP',
  //       },
  //     ],

  //     LoadBalancerName: process.env.AWS_LOADBALANCER,
  //     SecurityGroups: [groupLBId],
  //   })
  //   .promise();

  // await elb
  //   .configureHealthCheck({
  //     HealthCheck: {
  //       HealthyThreshold: 2,
  //       Interval: 30,
  //       Target: 'HTTP:80/healthcheck',
  //       Timeout: 3,
  //       UnhealthyThreshold: 2,
  //     },
  //     LoadBalancerName: process.env.AWS_LOADBALANCER,
  //   })

  //   .promise();

  await autoscaling
    .createAutoScalingGroup({
      AutoScalingGroupName: process.env.AWS_AUTOSCALING,
      AvailabilityZones: [process.env.AWS_AVAILABILITY],
      HealthCheckGracePeriod: 180,
      HealthCheckType: 'ELB',
      LaunchConfigurationName: process.env.AWS_LAUNCHCONFIG,
      LoadBalancerNames: [process.env.AWS_LOADBALANCER],
      MaxSize: 3,
      MinSize: 1,
    })
    .promise();
})();
