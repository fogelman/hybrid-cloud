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
    console.log(`Deletando grupo ${GroupName}`);
    await ec2.deleteSecurityGroup({ GroupName }).promise();
  }
};

(async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });
  const elb = await new AWS.ELB({ apiVersion: '2012-06-01' });
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

  const autoScallingIds = await autoscaling
    .describeAutoScalingGroups({
      AutoScalingGroupNames: [process.env.AWS_AUTOSCALING],
    })
    .promise()
    .then(({ AutoScalingGroups }) => {
      return AutoScalingGroups.map(el => {
        return el.AutoScalingGroupName;
      });
    });

  if (autoScallingIds && autoScallingIds.length > 0) {
    await autoscaling
      .deleteAutoScalingGroup({
        AutoScalingGroupName: process.env.AWS_AUTOSCALING,
      })
      .promise();
  }

  const launchConfig = await autoscaling
    .describeLaunchConfigurations({
      LaunchConfigurationNames: [process.env.AWS_LAUNCHCONFIG],
    })
    .promise()
    .then(({ LaunchConfigurations }) => {
      if (LaunchConfigurations && LaunchConfigurations.length > 0) {
        return true;
      }
      return null;
    });

  if (launchConfig) {
    await autoscaling
      .deleteLaunchConfiguration({
        LaunchConfigurationName: process.env.AWS_LAUNCHCONFIG,
      })
      .promise();
  }

  const elbs = await elb
    .describeLoadBalancers({
      LoadBalancerNames: [process.env.AWS_LOADBALANCER],
    })
    .promise()
    .then(({ LoadBalancerDescriptions }) => {
      console.log(JSON.stringify(LoadBalancerDescriptions));
      return LoadBalancerDescriptions.flatMap(el => {
        return el.LoadBalancerName;
      });
    })
    .catch(e => {
      if (e.code !== 'LoadBalancerNotFound') {
        throw e;
      }
      return null;
    });

  if (elbs && elbs.length > 0) {
    await elb
      .deleteLoadBalancer({
        LoadBalancerName: process.env.AWS_LOADBALANCER,
      })
      .promise();
  }
  await deleteGroup(ec2, process.env.AWS_SECURITYGROUP_ELB);
})();
