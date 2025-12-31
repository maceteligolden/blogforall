#!/bin/bash

# Quick script to push with GitHub token
# Usage: GITHUB_TOKEN=your_token ./push-with-token.sh

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable not set"
  echo ""
  echo "Usage:"
  echo "  GITHUB_TOKEN=your_token_here ./push-with-token.sh"
  echo ""
  echo "Or export it first:"
  echo "  export GITHUB_TOKEN=your_token_here"
  echo "  ./push-with-token.sh"
  exit 1
fi

# Update remote with token
git remote set-url origin https://${GITHUB_TOKEN}@github.com/maceteligolden/blogforall.git

# Push
echo "Pushing to origin main..."
git push origin main

# Reset remote to HTTPS without token (for security)
git remote set-url origin https://github.com/maceteligolden/blogforall.git

echo ""
echo "✓ Push completed!"

