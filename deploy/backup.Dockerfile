FROM docker.io/library/alpine:3.20
RUN apk add --no-cache postgresql17-client age tar gzip

# Backup artifacts stay on the host under BACKUP_DIR (a plain local path).
# No rclone, no remote, no dedicated volume.
COPY deploy/backup.sh /usr/local/bin/backup.sh
COPY deploy/restore.sh /usr/local/bin/restore.sh
COPY deploy/restore-files.sh /usr/local/bin/restore-files.sh
COPY deploy/restore-drill.sh /usr/local/bin/restore-drill.sh
COPY deploy/backup.crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/restore-files.sh /usr/local/bin/restore-drill.sh

CMD ["crond", "-f", "-l", "2"]
