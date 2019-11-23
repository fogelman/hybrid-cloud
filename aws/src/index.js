const path = require('path');
const chalk = require('chalk');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { run: ohio, authorize } = require('./ohio');
const { run: virginia } = require('./virginia');
const clean = require('./clean');

(async () => {
  console.log(chalk`{yellow.bold iniciando}`);
  await clean();
  console.log(chalk`delete {green.bold completo}`);
  console.log(chalk`região ohio: {yellow.bold iniciando}`);

  const { ip, groupId } = await ohio();
  console.log(chalk`região ohio: {green.bold setup completa}`);
  console.log(chalk`região virginia: {yellow.bold iniciando}`);
  const BASE_URL = await virginia(ip);
  console.log(chalk`região virginia: {green.bold setup completa}`);
  await authorize(groupId, BASE_URL);
  console.log(chalk`\naplicação {green.bold pronta} para uso virginia`);
})();
