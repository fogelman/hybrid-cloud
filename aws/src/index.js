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
  #!/bin/bash
apt update -y
curl -O https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o ~/etc/init.d/webserver.sh
chmod +x /etc/init.d/webserver.sh
`;

  const UserData = Buffer.from(data).toString('base64');
  var instanceId;
  await ec2
    .runInstances({
      ...instanceRules,
      KeyName: 'default',
      SecurityGroups: [secGroup],
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            {
              Key: 'Name',
              Value: 'cloud-project',
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
  // const elbv2 = await new AWS.ELBv2({ apiVersion: '2015-12-01' });
  // var autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });

  // const rds = await new AWS.RDS();

  ec2.waitFor(
    'instanceStatusOk',
    {
      InstanceIds: [],
    },
    function(err, data) {
      if (err) console.log(err, err.stack);
      // an error occurred
      else console.log(data); // successful response
    }
  );
})();
