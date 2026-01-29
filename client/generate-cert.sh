#!/bin/bash

# Script to generate a self-signed certificate for local HTTPS development
# Uses mkcert to create locally-trusted certificates

set -e

CERT_DIR="$(dirname "$0")/.cert"

echo "Setting up HTTPS certificate for local development..."

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "Error: mkcert is not installed."
    echo ""
    echo "Please install mkcert first:"
    echo "  On macOS (run on your Mac, not in the container):"
    echo "    brew install mkcert"
    echo "    brew install nss  # for Firefox support"
    echo ""
    echo "  On Linux (in your container):"
    echo "    sudo apt-get update"
    echo "    sudo apt-get install -y libnss3-tools"
    echo "    curl -JLO 'https://dl.filippo.io/mkcert/latest?for=linux/amd64'"
    echo "    chmod +x mkcert-v*-linux-amd64"
    echo "    sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert"
    echo ""
    exit 1
fi

# Create certificate directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Install the local CA (only needs to be done once)
echo "Installing local CA..."
mkcert -install

# Generate certificate for localhost
echo "Generating certificate for localhost..."
cd "$CERT_DIR"
mkcert localhost 127.0.0.1 ::1

# Rename to consistent names
mv localhost+2.pem cert.pem
mv localhost+2-key.pem key.pem

echo ""
echo "✅ Certificate generated successfully!"
echo "📁 Certificate location: $CERT_DIR"
echo ""
echo "⚠️  IMPORTANT: If you're using a container, you need to:"
echo "1. Run 'mkcert -install' on your Mac to trust the CA"
echo "2. Copy the CA root cert to your Mac's trust store"
echo ""
echo "To get the CA root cert location, run: mkcert -CAROOT"
