#!/bin/bash
apt install mongodb
sed -i 's/bindIp = 127.0.0.1/bindIp = 0.0.0.0/g' /etc/mongodb.conf
service mongod restart
