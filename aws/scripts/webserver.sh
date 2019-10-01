#!/bin/bash
apt update -y
curl -O https://raw.githubusercontent.com/Fogelman/hybrid-cloud/master/aws/scripts/webserver.sh -o ~/etc/init.d/webserver.sh
chmod +x /etc/init.d/webserver.sh
