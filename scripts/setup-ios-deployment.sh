#!/bin/bash

# iOS Deployment Setup Script
# This script helps set up the iOS deployment pipeline

set -e

echo "🍎 iOS TestFlight Deployment Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

echo "📋 This script will help you set up iOS TestFlight deployment."
echo "   Please have the following ready:"
echo ""
echo "   1. Apple Developer Program membership (\$99/year)"
echo "   2. App Store Connect API key (.p8 file)"
echo "   3. Private GitHub repository for certificates"
echo "   4. GitHub personal access token"
echo ""

read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

echo ""
echo "🔧 Setting up Fastlane..."

# Create iOS directory if it doesn't exist
if [ ! -d "ios" ]; then
    echo "❌ Error: iOS directory not found. Please run 'npx cap add ios' first."
    exit 1
fi

# Create fastlane directory
mkdir -p ios/fastlane

echo "✅ Fastlane structure created"

echo ""
echo "📦 Installing Fastlane dependencies..."

cd ios

# Install bundler if not already installed
if ! command -v bundle &> /dev/null; then
    gem install bundler
fi

# Install fastlane
bundle install

echo "✅ Fastlane installed"

echo ""
echo "🔐 Setting up certificate management..."

# Initialize Fastlane Match
echo "   You'll need to provide a Git URL for storing certificates."
echo "   Example: https://github.com/yourusername/ios-certificates.git"
echo ""

read -p "Enter your certificates repository URL: " CERTS_REPO_URL

if [ -z "$CERTS_REPO_URL" ]; then
    echo "❌ Error: Certificates repository URL is required"
    exit 1
fi

# Update Matchfile with the provided URL
cat > fastlane/Matchfile << EOF
git_url("$CERTS_REPO_URL")

storage_mode("git")

type("development") # The default type, can be: appstore, adhoc, development, enterprise

app_identifier(["com.aichat.app"])
username("") # Your Apple ID email - will be set via ASC API key

# For all available options run \`fastlane match --help\`
EOF

echo "✅ Matchfile configured"

cd ..

echo ""
echo "📝 GitHub Secrets Setup"
echo "======================"
echo ""
echo "Please add the following secrets to your GitHub repository:"
echo "(Settings → Secrets and variables → Actions → New repository secret)"
echo ""
echo "1. ASC_KEY_ID"
echo "   → Your App Store Connect API Key ID"
echo ""
echo "2. ASC_ISSUER_ID" 
echo "   → Your App Store Connect Issuer ID"
echo ""
echo "3. ASC_PRIVATE_KEY"
echo "   → Your .p8 file content in base64"
echo "   → Run: cat AuthKey_XXXXX.p8 | base64 | pbcopy"
echo ""
echo "4. MATCH_PASSWORD"
echo "   → Choose a strong password for encrypting certificates"
echo ""
echo "5. MATCH_GIT_BASIC_AUTHORIZATION"
echo "   → GitHub credentials for certificates repo"
echo "   → Run: echo -n 'username:token' | base64"
echo ""
echo "6. MATCH_GIT_URL"
echo "   → Your certificates repository URL: $CERTS_REPO_URL"
echo ""

echo "🎯 Next Steps"
echo "============"
echo ""
echo "1. Complete the manual setup steps in iOS-DEPLOYMENT.md"
echo "2. Add the GitHub secrets listed above"
echo "3. Push to main branch to trigger the first build"
echo "4. Check GitHub Actions for build progress"
echo "5. Look for your app in TestFlight within 15 minutes"
echo ""
echo "📖 For detailed instructions, see: iOS-DEPLOYMENT.md"
echo ""
echo "✅ Setup script completed!"