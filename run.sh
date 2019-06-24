#!/bin/bash
#die()
case "$1" in
	stop|restart)
		forever $1 server.js apifox
		forever $1 process-mt-content.js
		;;
	*)
		forever -al /mnt/backup/logs/node/apifox/server.log $1 server.js apifox
		forever -al /mnt/backup/logs/node/apifox/sender.log $1 process-mt-content.js apifox
	exit 1
esac
