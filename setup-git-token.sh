#!/bin/bash

# Script to set up GitHub token for git authentication
# Usage: ./setup-git-token.sh YOUR_GITHUB_TOKEN

if [ -z "$1" ]; then
  echo "Usage: ./setup-git-token.sh YOUR_GITHUB_TOKEN"
  echo ""
  echo "Or set GITHUB_TOKEN environment variable:"
  echo "  export GITHUB_TOKEN=your_token_here"
  echo "  ./setup-git-token.sh"
  exit 1
fi

TOKEN=${1:-$GITHUB_TOKEN}

if [ -z "$TOKEN" ]; then
  echo "Error: No token provided"
  exit 1
fi

# Update remote URL with token
git remote set-url origin https://${TOKEN}@github.com/maceteligolden/blogforall.git

echo "✓ Remote URL updated with token"
echo ""
echo "You can now push with: git push origin main"
echo ""
echo "Note: The token is stored in the remote URL. For better security,"
echo "consider using SSH keys or git credential helper instead."

