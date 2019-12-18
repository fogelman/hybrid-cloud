const AWS = require('aws-sdk');
const chalk = require('chalk');
require('dotenv/config');

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
    await ec2.deleteSecurityGroup({ GroupName }).promise();
    //console.log(`Grupo ${GroupName} deletado`);
  }
};

const terminateInstances = async (ec2, GroupName) => {
  const instances = await ec2
    .describeInstances({
      Filters: [
        {
          Name: 'instance.group-name',
          Values: [GroupName],
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
};

module.exports = async () => {
  const ec2 = await new AWS.EC2({ apiVersion: '2016-11-15' });
  const ec2_ohio = await new AWS.EC2({
    apiVersion: '2016-11-15',
    region: 'us-east-2',
  });
  const autoscaling = await new AWS.AutoScaling({ apiVersion: '2011-01-01' });
  const elbv2 = await new AWS.ELBv2();

  const imageIds = await ec2
    .describeImages({
      Filters: [{ Name: 'name', Values: [process.env.AWS_IMAGENAME] }],
    })
    .promise()
    .then(data => {
      if ('Images' in data && data.Images > 0) {
        return data.Images.flatMap(image => {
          return image.ImageId;
        });
      }
      return null;
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
        ForceDelete: true,
      })
      .promise();
  }

  const elbs = await elbv2
    .describeLoadBalancers({
      Names: [process.env.AWS_LOADBALANCER],
    })
    .promise()
    .then(({ LoadBalancers }) => {
      return LoadBalancers.map(el => {
        return el.LoadBalancerArn;
      });
    })
    .catch(e => {
      if (e.code !== 'LoadBalancerNotFound') {
        throw e;
      }
      return null;
    });

  if (elbs && elbs.length > 0) {
    const listenersArr = await Promise.all(
      elbs.flatMap(el => {
        return elbv2
          .describeListeners({ LoadBalancerArn: el })
          .promise()
          .then(({ Listeners }) => {
            if (!Listeners && Listeners.length === 0) {
              return null;
            }
            return Listeners.flatMap(el => {
              if (el.ListenerArn) {
                return el.ListenerArn;
              }
              return;
            });
          });
      })
    );

    const listeners = [].concat.apply([], listenersArr);

    if (listeners && listeners.length > 0) {
      await Promise.all(
        listeners.map(el => {
          return elbv2
            .deleteListener({ ListenerArn: el })
            .promise()
            .catch(e => {
              console.log(e, e.stack);
            });
        })
      );
    }

    await Promise.all(
      elbs.map(el => {
        return elbv2.deleteLoadBalancer({ LoadBalancerArn: el }).promise();
      })
    );

    await Promise.all(
      elbs.map(el => {
        return elbv2
          .waitFor('loadBalancersDeleted', {
            LoadBalancerArns: [el],
          })
          .promise();
      })
    );
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

  const targets = await elbv2
    .describeTargetGroups({
      Names: [process.env.AWS_TARGETGROUP],
    })
    .promise()
    .then(({ TargetGroups }) => {
      return TargetGroups.flatMap(el => {
        return el.TargetGroupArn;
      });
    })
    .catch(e => {
      if (e.code !== 'TargetGroupNotFound') {
        throw e;
      }
    });

  if (targets && targets.length > 0) {
    await Promise.all(
      targets.map(async el => {
        return elbv2
          .deleteTargetGroup({
            TargetGroupArn: el,
          })
          .promise();
      })
    );
  }
  await terminateInstances(ec2, process.env.AWS_SECURITYGROUP);
  await terminateInstances(ec2, process.env.AWS_SECURITYGROUP_SCALE);
  await terminateInstances(ec2_ohio, process.env.AWS_SECURITYGROUP);
  //console.log(`Instâncias do grupo ${process.env.AWS_SECURITYGROUP} deletadas`);

  await ec2.deleteKeyPair({ KeyName: process.env.AWS_KEYNAME }).promise();
  await ec2_ohio.deleteKeyPair({ KeyName: process.env.AWS_KEYNAME }).promise();

  await deleteGroup(ec2, process.env.AWS_SECURITYGROUP);
  await deleteGroup(ec2, process.env.AWS_SECURITYGROUP_SCALE);
  await deleteGroup(ec2_ohio, process.env.AWS_SECURITYGROUP);

  const groupId = await ec2
    .describeSecurityGroups({
      Filters: [
        { Name: 'group-name', Values: [process.env.AWS_SECURITYGROUP_ELB] },
      ],
    })
    .promise()
    .then(({ SecurityGroups }) => {
      if (SecurityGroups && SecurityGroups.length > 0) {
        return SecurityGroups[0].GroupId;
      }
      return null;
    });

  if (groupId) {
    const references = await ec2
      .describeSecurityGroupReferences({ GroupId: [groupId] })
      .promise();
  }
  await deleteGroup(ec2, process.env.AWS_SECURITYGROUP_ELB).catch(e => {
    console.error('error', e);
  });
};
