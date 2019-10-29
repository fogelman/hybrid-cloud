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

const deleteGroup = async (ec2, GroupName) => {
  const groups = await ec2
    .describeSecurityGroups({
      Filters: [{ Name: 'group-name', Values: [GroupName] }],
    })
    .promise()
    .then(({ SecurityGroups }) => {
      return SecurityGroups;
    });

  if (groups && groups.length > 0) {
    await ec2.deleteSecurityGroup({ GroupName: GroupName }).promise();
  }
};

(async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const instances = await ec2
    .describeInstances({
      Filters: [
        {
          Name: 'instance.group-name',
          Values: [process.env.AWS_SECURITYGROUP],
        },
      ],
    })
    .promise()
    .then(({ Reservations }) => {
      return Reservations.flatMap(instance => {
        return instance.Instances.map(i => {
          return i.InstanceId;
        });
      });
    });

  if (instances && instances.length > 0) {
    await ec2.terminateInstances({ InstanceIds: instances }).promise();
    await ec2
      .waitFor('instanceTerminated', {
        InstanceIds: instances,
      })
      .promise();
  }

  await deleteGroup(ec2, process.env.AWS_SECURITYGROUP);
  // await deleteGroup(ec2, process.env.AWS_SECURITYGROUP_ELB);

  await ec2.deleteKeyPair({ KeyName: process.env.AWS_KEYNAME }).promise();

  const imageIds = await ec2
    .describeImages({
      Filters: [{ Name: 'name', Values: [process.env.AWS_IMAGENAME] }],
    })
    .promise()
    .then(data => {
      return data.Images.flatMap(image => {
        return image.ImageId;
      });
    });

  if (imageIds && imageIds.length > 0) {
    await Promise.all(
      imageIds.map(id => {
        return ec2.deregisterImage({ ImageId: id }).promise();
      })
    );
  }
})();
