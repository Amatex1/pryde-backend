FROM clamav/clamav:1.4

# The official clamav/clamav image already:
#  - runs clamd listening on TCP 3310
#  - runs freshclam to keep virus definitions updated automatically
#
# We just override two settings:
#  1. Increase max file size to match our upload limit (100MB)
#  2. Enable TCP socket explicitly (some builds default to unix socket only)

COPY clamd.conf /etc/clamav/clamd.conf
COPY freshclam.conf /etc/clamav/freshclam.conf

EXPOSE 3310
