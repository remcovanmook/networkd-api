#!/bin/bash
# setup-remote-host.sh
# Usage: ./setup-remote-host.sh <hostname_or_ip> [username]
# Uses current user's SSH execution to set up networkd-api user on remote host.
# Requires the API backend to be running to fetch the public key, or provide PUBKEY manually.

HOST=$1
USER=${2:-root}
API_URL=${API_URL:-"http://localhost:8080"}

if [ -z "$HOST" ]; then
    echo "Usage: $0 <hostname_or_ip> [initial_ssh_user]"
    exit 1
fi

echo "Fetching public key from $API_URL/api/system/ssh-key..."
PUBKEY=$(curl -s --fail "$API_URL/api/system/ssh-key")

if [ -z "$PUBKEY" ]; then
    echo "Error: Failed to fetch public key from $API_URL. Is the server running?"
    exit 1
fi

echo "Setting up 'networkd-api' user on $HOST..."

# Remote script to execute
REMOTE_SCRIPT="
set -e
if ! id -u networkd-api >/dev/null 2>&1; then
    echo 'Creating user networkd-api...'
    useradd -m -s /bin/bash networkd-api
fi

echo 'Configuring SSH access...'
mkdir -p /home/networkd-api/.ssh
chmod 700 /home/networkd-api/.ssh
echo '$PUBKEY' > /home/networkd-api/.ssh/authorized_keys
chmod 600 /home/networkd-api/.ssh/authorized_keys
chown -R networkd-api:networkd-api /home/networkd-api/.ssh

echo 'Configuring sudo access...'
echo 'networkd-api ALL=(ALL) NOPASSWD: /usr/bin/networkctl, /usr/bin/tee /etc/systemd/network/*, /usr/bin/rm /etc/systemd/network/*, /usr/bin/mkdir -p /etc/systemd/network, /usr/bin/cat /etc/systemd/network/*' > /etc/sudoers.d/networkd-api
chmod 440 /etc/sudoers.d/networkd-api

echo 'Done.'
"

ssh "$USER@$HOST" "$REMOTE_SCRIPT"
