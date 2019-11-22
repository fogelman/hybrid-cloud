#!/bin/bash
git clone --depth=1 --no-tags https://github.com/Fogelman/hybrid-cloud.git /home/ubuntu/hybrid-cloud
cd /home/ubuntu/hybrid-cloud/app
npm i
pm2 start ./src/index.js --name "app"
pm2 save
exit 0
