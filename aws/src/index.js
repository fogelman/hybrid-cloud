const { run: ohio, authorize } = require('./ohio');
const { run: virginia } = require('./virginia');
const clean = require('./clean');

(async () => {
  await clean();
  const { ip, groupId } = await ohio();
  const BASE_URL = await virginia(ip);
  await authorize(groupId, BASE_URL);

  console.log(BASE_URL, ip);
})();
