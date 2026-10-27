FROM postgres:17-alpine

# age for client-side encryption, rclone for the offsite copy, tzdata so the
# schedule is predictable across hosts.
RUN apk add --no-cache age rclone tzdata

COPY deploy/backup.sh deploy/restore.sh deploy/restore-files.sh /usr/local/bin/
COPY deploy/backup.crontab /etc/crontabs/root

RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/restore-files.sh

# BusyBox crond, foreground so Docker supervises it.
CMD ["crond", "-f", "-l", "2"]
