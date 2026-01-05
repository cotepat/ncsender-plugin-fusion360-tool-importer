#!/bin/bash

# Test packaging locally before release
# Useful for development and testing

set -e

echo "Testing plugin package creation..."

# Run the package script
./.scripts/package.sh

PLUGIN_ID=$(node -p "require('./manifest.json').id")
VERSION=$(node -p "require('./manifest.json').version")
PACKAGE_NAME="${PLUGIN_ID}-v${VERSION}.zip"

echo ""
echo "Package created successfully: ${PACKAGE_NAME}"
echo ""
echo "To test installation:"
echo "1. Copy ${PACKAGE_NAME} to your ncSender plugins directory"
echo "2. Extract the zip file"
echo "3. Restart ncSender"
echo ""
echo "Plugin directory locations:"
echo "  macOS: ~/Library/Application Support/ncSender/plugins/"
echo "  Windows: %APPDATA%\\ncSender\\plugins\\"
echo "  Linux: ~/.config/ncSender/plugins/"

