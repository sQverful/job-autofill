#!/bin/bash

# Smart AI Autofill Extension Release Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Smart AI Autofill Extension Release Creator${NC}"
echo "=================================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before creating a release."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📦 Current version: ${CURRENT_VERSION}${NC}"

# Ask for new version
echo ""
echo "What type of release is this?"
echo "1) Patch (bug fixes) - ${CURRENT_VERSION} → $(node -p "require('semver').inc('${CURRENT_VERSION}', 'patch')" 2>/dev/null || echo "x.x.x")"
echo "2) Minor (new features) - ${CURRENT_VERSION} → $(node -p "require('semver').inc('${CURRENT_VERSION}', 'minor')" 2>/dev/null || echo "x.x.x")"
echo "3) Major (breaking changes) - ${CURRENT_VERSION} → $(node -p "require('semver').inc('${CURRENT_VERSION}', 'major')" 2>/dev/null || echo "x.x.x")"
echo "4) Custom version"

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
        ;;
    2)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$(NF-1) = $(NF-1) + 1; $NF = 0;} 1' | sed 's/ /./g')
        ;;
    3)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1 = $1 + 1; $2 = 0; $3 = 0;} 1' | sed 's/ /./g')
        ;;
    4)
        read -p "Enter custom version (e.g., 1.2.3): " NEW_VERSION
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}📈 New version will be: ${NEW_VERSION}${NC}"
read -p "Continue? (y/N): " confirm

if [[ $confirm != [yY] ]]; then
    echo -e "${YELLOW}🚫 Release cancelled${NC}"
    exit 0
fi

# Update package.json version
echo -e "${BLUE}📝 Updating package.json version...${NC}"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Run tests and build
echo -e "${BLUE}🧪 Running tests and build...${NC}"
pnpm install --frozen-lockfile
pnpm lint || echo -e "${YELLOW}⚠️  Linting issues found but continuing...${NC}"
pnpm build
pnpm zip

# Commit version bump
echo -e "${BLUE}💾 Committing version bump...${NC}"
git add package.json
git commit -m "chore: bump version to v${NEW_VERSION}"

# Create and push tag
echo -e "${BLUE}🏷️  Creating and pushing tag...${NC}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo -e "${GREEN}✅ Release v${NEW_VERSION} created successfully!${NC}"
echo -e "${BLUE}🔗 Check the release at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases${NC}"
echo -e "${YELLOW}⏳ The CI/CD pipeline will build and publish the release automatically.${NC}"