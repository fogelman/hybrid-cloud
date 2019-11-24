// https://gist.github.com/tinovyatkin/4316e302d8419186fe3c6af3f26badff
const readline = require('readline');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');

readline.Interface.prototype.question[promisify.custom] = function(prompt) {
  return new Promise(resolve =>
    readline.Interface.prototype.question.call(this, prompt, resolve)
  );
};
readline.Interface.prototype.ask = promisify(
  readline.Interface.prototype.question
);

(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const key = await rl.ask('AWS Access Key ID []: ');
  const secret = await rl.ask('AWS Secret Access Key []: ');
  const project = await rl.ask('PROJECT name []: ');
  const env = `AWS_REGION="us-east-1"
AWS_AVAILABILITY="us-east-1a"
AWS_ACESSKEY="${key}"
AWS_SECRETACCESSKEY="${secret}"

AWS_PROJECTNAME="${project}"
AWS_SECURITYGROUP="${project}"
AWS_SECURITYGROUP_SCALE="${project}-scale"
AWS_SECURITYGROUP_ELB="${project}-elb"
AWS_KEYNAME="${project}"
AWS_IMAGENAME="${project}"
AWS_LOADBALANCER="${project}"
AWS_LAUNCHCONFIG="${project}"
AWS_AUTOSCALING="${project}"
AWS_TARGETGROUP="${project}"
AWS_LAUNCHTEMPLATE="${project}"
  `;
  await promisify(fs.writeFile)(path.resolve(__dirname, '..', '.env'), env);
  rl.close();
})();
