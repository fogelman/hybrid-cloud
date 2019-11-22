const { run: ohio, authorize } = require('./ohio');
const { run: virginia } = require('./virginia');
const clean = require('./clean');

(async () => {
  await clean();
  const { ip, groupId } = await ohio();
  return;
  const BASE_URL = await virginia(ip);
  await authorize(groupId, BASE_URL);
})();
