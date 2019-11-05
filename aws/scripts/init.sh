#!/bin/bash
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
apt install -y nodejs
ln -s /usr/bin/nodejs /usr/bin/node
npm install -g pm2
pm2 startup
