#!/bin/bash

### BEGIN INIT INFO
# Provides:          hybridcloud
# Required-Start:    $all
# Required-Stop:
# Default-Start:     2 3 4 5
# Default-Stop:
# Short-Description: Configuration for hybrid cloud
### END INIT INFO

git clone --depth=1 --no-tags https://github.com/Fogelman/hybrid-cloud.git /home/ubuntu/hybrid-cloud

exit 0
