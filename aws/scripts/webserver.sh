#!/bin/bash

### BEGIN INIT INFO
# Provides:          hybridcloud
# Required-Start:    $all
# Required-Stop:
# Default-Start:     2 3 4 5
# Default-Stop:
# Short-Description: Configuration for hybrid cloud
### END INIT INFO

pm2 start /home/ubuntu/hybrid-cloud/web-app/src/index.js --name "app"
pm2 save
exit 0
