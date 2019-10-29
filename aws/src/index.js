const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
require('dotenv').config();

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
(async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });
  const elb = await new AWS.ELB({ apiVersion: '2012-06-01' });
  const groupId = await createSecurityGroup(ec2, process.env.AWS_SECURITYGROUP);
  const groupLBId = await createSecurityGroup(
    ec2,
    process.env.AWS_SECURITYGROUP_ELB
  );

  await ec2.authorizeSecurityGroupIngress({
    GroupName: process.env.AWS_SECURITYGROUP,
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
  });

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
      return data;
    });

  await autoscaling
    .createLaunchConfiguration({
      ImageId: imageId,
      InstanceType: 't2-micro',
      LaunchConfigurationName: 'david-webserver',
      SecurityGroups: [groupId],
    })
    .promise();

  // await elb.createLoadBalancer()

  await elb
    .createLoadBalancer({
      Listeners: [
        {
          InstancePort: 80,
          InstanceProtocol: 'HTTP',
          LoadBalancerPort: 80,
          Protocol: 'HTTP',
        },
      ],
      LoadBalancerName: process.env.AWS_LOADBALANCER,
      SecurityGroups: [groupLBId],
    })
    .promise();
})();
