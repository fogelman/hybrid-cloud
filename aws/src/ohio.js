const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// MONGO_URI
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
const data = {
  mongo: `#!/bin/bash
apt update -y
apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/mongo.sh -o /home/ubuntu/mongo.sh
chmod +x /home/ubuntu/mongo.sh
sh /home/ubuntu/mongo.sh
`,
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

const authorizeExternalIP = async (GroupId, ip) => {
  console.log(`Autorizando a entrada para o grupo: ${GroupId}`);
  const ec2 = await new AWS.EC2({
    apiVersion: '2016-11-15',
    region: 'us-east-2',
  });
  await ec2
    .authorizeSecurityGroupIngress({
      GroupId,
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 3333,
          ToPort: 3333,
          IpRanges: [{ CidrIp: ip }],
        },
      ],
    })
    .promise();
};

const run = async () => {
  const ec2 = await new AWS.EC2({
    apiVersion: '2016-11-15',
    region: 'us-east-2',
  });

  const groupId = await createSecurityGroup(ec2, process.env.AWS_SECURITYGROUP);

  await authorizeSecurityGroupIngress(ec2, groupId);
  console.log('Grupo autorizado');
  await ec2
    .createKeyPair({ KeyName: process.env.AWS_KEYNAME })
    .promise()
    .then(async ({ KeyMaterial: data }) => {
      await promisify(fs.writeFile)('aws-key-ohio.pem', data);
    });

  const { InstanceId: mongoId, PrivateIpAddress: ip } = await ec2
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
              Key: 'Service',
              Value: 'mongo',
            },
          ],
        },
      ],
      UserData: Buffer.from(data.mongo).toString('base64'),
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0];
    });

  const app = `#!/bin/bash
  apt update -y
  echo "export MONGO_URI=\"mongodb://${ip}/admin\"" >> .bashrc
  source .bashrc
  apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
  curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/init.sh -o /home/ubuntu/init.sh
  chmod +x /home/ubuntu/init.sh
  sh /home/ubuntu/init.sh
  curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/app.sh -o /home/ubuntu/app.sh
  chmod +x /home/ubuntu/app.sh
  sh /home/ubuntu/app.sh
  `;

  const { InstanceId: appId } = await ec2
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
      UserData: Buffer.from(app).toString('base64'),
      DryRun: false,
    })
    .promise()
    .then(({ Instances }) => {
      return Instances[0];
    });

  await ec2
    .waitFor('instanceStatusOk', {
      InstanceIds: [mongoId, appId],
    })
    .promise()
    .catch(err => {
      console.log(err, err.stack);
    });
  console.log(`Instância criada com sucesso`);

  const apiIp = await ec2
    .describeInstances({
      InstanceIds: [appId],
    })
    .promise()
    .then(({ Reservations }) => {
      return Reservations[0].Instances[0].PublicIpAddress;
    });

  return { ip: apiIp, groupId };
};

module.exports.run = run;
module.exports.authorize = authorizeExternalIP;
