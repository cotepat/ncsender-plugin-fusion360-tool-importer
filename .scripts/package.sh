#!/bin/bash

# Package the plugin for distribution
# Creates a zip file ready for installation in ncSender

set -e

PLUGIN_ID=$(node -p "require('./manifest.json').id")
VERSION=$(node -p "require('./manifest.json').version")
PACKAGE_NAME="${PLUGIN_ID}-v${VERSION}.zip"

echo "Packaging ${PLUGIN_ID} v${VERSION}..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
PLUGIN_DIR="${TEMP_DIR}/${PLUGIN_ID}"
mkdir -p "${PLUGIN_DIR}"

# Copy plugin files
cp manifest.json "${PLUGIN_DIR}/"
cp index.js "${PLUGIN_DIR}/"
cp tool-importer.js "${PLUGIN_DIR}/"

# Include logo if it exists
if [ -f "logo.png" ]; then
  cp logo.png "${PLUGIN_DIR}/"
fi

# Create zip file
cd "${TEMP_DIR}"
zip -r "${PACKAGE_NAME}" "${PLUGIN_ID}/"
cd -

# Move zip to current directory
mv "${TEMP_DIR}/${PACKAGE_NAME}" .

# Cleanup
rm -rf "${TEMP_DIR}"

echo "Package created: ${PACKAGE_NAME}"

