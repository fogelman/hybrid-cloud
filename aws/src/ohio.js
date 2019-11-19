const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

AWS.config = new AWS.Config({
  region: 'us-east-2',
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
  ImageId: 'ami-0d5d9d301c853a04a',
  InstanceType: 't2.micro',
  MaxCount: 1,
  MinCount: 1,
};
const data = `#!/bin/bash
apt update -y
apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/mongo.sh -o /home/ubuntu/mongo.sh
chmod +x /home/ubuntu/mongo.sh
sh /home/ubuntu/mongo.sh
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
        {
          IpProtocol: 'tcp',
          FromPort: 3333,
          ToPort: 3333,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
        {
          IpProtocol: 'tcp',
          FromPort: 27017,
          ToPort: 27017,
          UserIdGroupPairs: [
            {
              Description: 'acesso somente ao grupo',
              GroupId,
            },
          ],
        },
      ],
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

const run = async () => {
  const ec2 = await new AWS.EC2({
    apiVersion: '2016-11-15',
    region: 'us-east-2',
  });

  // const vpc = await describeVpcs(ec2);
  // const subnets = await ec2
  //   .describeSubnets({
  //     Filters: [{ Name: 'vpc-id', Values: [vpc] }],
  //   })
  //   .promise()
  //   .then(({ Subnets }) => {
  //     return Subnets.map(el => el.SubnetId);
  //   });

  const groupId = await createSecurityGroup(ec2, process.env.AWS_SECURITYGROUP);

  await authorizeSecurityGroupIngress(ec2, groupId);
  console.log('Grupo autorizado');
  await ec2
    .createKeyPair({ KeyName: process.env.AWS_KEYNAME })
    .promise()
    .then(async ({ KeyMaterial: data }) => {
      await promisify(fs.writeFile)('aws-key-ohio.pem', data);
    });
  const UserData = Buffer.from(data).toString('base64');
  const { InstanceId: instanceId, PrivateIpAddress: ip } = await ec2
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
      UserData,
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0];
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
};

module.exports = run;
run();
