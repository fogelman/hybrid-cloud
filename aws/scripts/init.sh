#!/bin/bash
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
apt install -y nodejs
npm install -g pm2
pm2 startup
pm2 save
