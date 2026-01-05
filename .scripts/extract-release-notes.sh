#!/bin/bash

# Extract release notes from latest_release.md
# Removes the title line and outputs the rest

set -e

if [ ! -f "latest_release.md" ]; then
  echo "No release notes available."
  exit 0
fi

# Skip the first line (title) and output the rest
tail -n +2 latest_release.md

