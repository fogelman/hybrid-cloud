#!/bin/bash
apt update
apt install mongodb -y
sed -i 's/bind_ip = 127.0.0.1/bind_ip = 0.0.0.0/g' /etc/mongodb.conf
service mongodb restart
