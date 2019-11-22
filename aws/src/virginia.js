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

const authorizeSecurityGroupIngress = async (ec2, GroupId, GroupPairs = []) => {
  console.log(`Autorizando a entrada para o grupo: ${GroupId}`);

  const permissions = [
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
  ];

  if (GroupPairs.length > 0) {
    permissions.push({
      IpProtocol: 'tcp',
      FromPort: 3333,
      ToPort: 3333,
      UserIdGroupPairs: GroupPairs.map(el => ({
        Description: 'acesso somente ao grupo',
        GroupId: el,
      })),
    });
  }

  await ec2
    .authorizeSecurityGroupIngress({
      GroupId,
      IpPermissions: permissions,
    })
    .promise();
};

const describeVpcs = async ec2 => {
  return await ec2
    .describeVpcs({
      Filters: [
        {
          Name: 'isDefault',
          Values: ['true'],
        },
      ],
    })
    .promise()
    .then(({ Vpcs }) => {
      if (Vpcs && Vpcs.length > 0) {
        return Vpcs[0].VpcId;
      }
    });
};

const run = async BASE_URL_DB => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });
  var elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });

  const vpc = await describeVpcs(ec2);
  const subnets = await ec2
    .describeSubnets({
      Filters: [{ Name: 'vpc-id', Values: [vpc] }],
    })
    .promise()
    .then(({ Subnets }) => {
      return Subnets.map(el => el.SubnetId);
    });

  const groupId = await createSecurityGroup(ec2, process.env.AWS_SECURITYGROUP);
  const groupScale = await createSecurityGroup(
    ec2,
    process.env.AWS_SECURITYGROUP_SCALE
  );
  const groupLBId = await createSecurityGroup(
    ec2,
    process.env.AWS_SECURITYGROUP_ELB
  );

  await authorizeSecurityGroupIngress(ec2, groupId, [groupScale]);
  await authorizeSecurityGroupIngress(ec2, groupScale, [groupLBId]);
  await authorizeSecurityGroupIngress(ec2, groupLBId);
  //console.log('Grupo autorizado');
  await ec2
    .createKeyPair({ KeyName: process.env.AWS_KEYNAME })
    .promise()
    .then(async ({ KeyMaterial: data }) => {
      await promisify(fs.writeFile)('aws-key.pem', data);
    });

  const data = `#!/bin/bash
apt update -y
echo "export BASE_URL=\"http://${BASE_URL_DB}:3333\"" >> ~/.bashrc
source ~/.bashrc
apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/init.sh -o /home/ubuntu/init.sh
chmod +x /home/ubuntu/init.sh
sh /home/ubuntu/init.sh
curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o /etc/init.d/webserver.sh
chmod +x /etc/init.d/webserver.sh
update-rc.d webserver.sh defaults
update-rc.d webserver.sh enable
`;

  const { PrivateIpAddress: PRIVATE_URL, InstanceId: redirectId } = await ec2
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
              Value: process.env.AWS_PROJECTNAME,
            },
          ],
        },
      ],
      UserData: Buffer.from(data).toString('base64'),
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0];
    });

  const webserver = `#!/bin/bash
    apt update -y
    echo "export BASE_URL=\"http://${PRIVATE_URL}:3333\"" >> .bashrc
    source .bashrc
    apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
    curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/init.sh -o /home/ubuntu/init.sh
    chmod +x /home/ubuntu/init.sh
    sh /home/ubuntu/init.sh
    curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o /etc/init.d/webserver.sh
    chmod +x /etc/init.d/webserver.sh
    update-rc.d webserver.sh defaults
    update-rc.d webserver.sh enable
    `;

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
              Value: process.env.AWS_PROJECTNAME,
            },
            {
              Key: 'Description',
              Value: 'redirect requests',
            },
          ],
        },
      ],
      UserData: Buffer.from(webserver).toString('base64'),
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0].InstanceId;
    });

  await ec2
    .waitFor('instanceStatusOk', {
      InstanceIds: [instanceId, redirectId],
    })
    .promise()
    .catch(err => {
      console.error(err, err.stack);
    });
  //console.log(`Instância criada com sucesso`);

  const BASE_URL = await ec2
    .describeInstances({
      InstanceIds: [redirectId],
    })
    .promise()
    .then(({ Reservations }) => {
      return Reservations[0].Instances[0].PublicIpAddress;
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
      return data.ImageId;
    });

  await ec2.waitFor('imageAvailable', { ImageIds: [imageId] }).promise();
  //console.log('Imagem criada com sucesso');

  await ec2.terminateInstances({ InstanceIds: [instanceId] }).promise();
  await autoscaling
    .createLaunchConfiguration({
      ImageId: imageId,
      InstanceType: 't2.micro',
      LaunchConfigurationName: process.env.AWS_LAUNCHCONFIG,
      SecurityGroups: [groupScale],
      KeyName: process.env.AWS_KEYNAME,
    })
    .promise();

  //console.log('Create launch configuration');

  const targets = await elbv2
    .createTargetGroup({
      Name: process.env.AWS_TARGETGROUP,
      Port: 3333,
      Protocol: 'HTTP',
      HealthCheckEnabled: true,
      HealthCheckIntervalSeconds: 10,
      // HealthCheckPort: '3333',
      HealthCheckProtocol: 'HTTP',
      UnhealthyThresholdCount: 2,
      HealthyThresholdCount: 2,
      HealthCheckPath: '/healthcheck',
      HealthCheckTimeoutSeconds: 2,

      VpcId: vpc,
    })
    .promise()
    .then(({ TargetGroups }) => {
      return TargetGroups.map(el => {
        return el.TargetGroupArn;
      });
    });

  //console.log('Target group criado');

  await autoscaling
    .createAutoScalingGroup({
      AutoScalingGroupName: process.env.AWS_AUTOSCALING,
      AvailabilityZones: [process.env.AWS_AVAILABILITY],
      HealthCheckGracePeriod: 120,
      HealthCheckType: 'ELB',

      LaunchConfigurationName: process.env.AWS_LAUNCHCONFIG,
      TargetGroupARNs: targets,
      MaxSize: 3,
      DesiredCapacity: 1,
      MinSize: 1,
      Tags: [
        { Key: 'Name', Value: process.env.AWS_PROJECTNAME },
        { Key: 'Description', Value: 'Automatic instance' },
      ],
    })
    .promise();

  //console.log('Criação do AutoScalling group');

  const { loadbalancersARN, loadbalancers } = await elbv2
    .createLoadBalancer({
      Name: process.env.AWS_LOADBALANCER,
      Scheme: 'internet-facing',
      Subnets: subnets,
      SecurityGroups: [groupLBId],
    })
    .promise()
    .catch(e => {})
    .then(({ LoadBalancers }) => {
      return {
        loadbalancersARN: LoadBalancers.map(el => el.LoadBalancerArn),
        loadbalancers: LoadBalancers,
      };
    });
  //console.log('Criação do Load Balancer');

  await elbv2
    .createListener({
      DefaultActions: [
        {
          TargetGroupArn: targets[0],
          Type: 'forward',
        },
      ],
      LoadBalancerArn: loadbalancersARN[0],
      Port: 80,
      Protocol: 'HTTP',
    })
    .promise();

  //console.log('Criação do Load Balancer listener');
  await elbv2.waitFor('loadBalancerAvailable').promise();
  console.log('loadbalancer', loadbalancers);
  if (loadbalancers.length > 0 && loadbalancers[0].DNSName) {
    console.log(`Load balancer está pronto e disponivel no endereço: ${'a'}`);
  } else {
    console.log(`Load balancer está pronto e disponivel`);
  }

  return BASE_URL;
};

module.exports.run = run;
