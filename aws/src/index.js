const AWS = require('aws-sdk');
const path = require('path');
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

(async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });

  const data = `#!/bin/bash
  apt update -y
  apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
  curl -fsSl https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o /etc/init.d/webserver.sh
  chmod +x /etc/init.d/webserver.sh
  update-rc.d webserver.sh defaults
  update-rc.d webserver.sh enable
`;
  const UserData = Buffer.from(data).toString('base64');
  var instanceId;
  await ec2
    .runInstances({
      ...instanceRules,
      KeyName: 'insper-fogelman',
      SecurityGroups: ['david-default'],
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
      instanceId = Instances[0].InstanceId;
    })
    .catch(err => console.error(err));

  await ec2
    .waitFor('instanceStatusOk', {
      InstanceIds: [instanceId],
    })
    .promise()
    .catch(err => {
      console.log(err, err.stack);
    });
})();
