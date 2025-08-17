#!/bin/bash

# GitHub Actions iOS Workflow Monitor
# Comprehensive monitoring script for iOS TestFlight deployment

set -e

echo "🚀 GitHub Actions iOS Workflow Monitor"
echo "======================================"
echo ""

# Configuration
POLL_INTERVAL=10
MAX_WAIT_TIME=3600  # 1 hour max
COUNTER=0
MAX_ITERATIONS=$((MAX_WAIT_TIME / POLL_INTERVAL))

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get latest run info
get_latest_run() {
    gh run list --limit 1 --json databaseId,status,conclusion,displayTitle,createdAt,headBranch | \
    jq -r '.[0] | "\(.databaseId)|\(.status)|\(.conclusion // "null")|\(.displayTitle)|\(.createdAt)|\(.headBranch)"'
}

# Function to get detailed step info
get_step_info() {
    local run_id=$1
    gh run view $run_id --json jobs | jq -r '
        .jobs[0].steps[] | 
        select(.status == "in_progress" or .status == "completed") |
        "\(.name)|\(.status)|\(.conclusion // "null")"
    ' | tail -1
}

# Function to check for specific errors
check_for_errors() {
    local run_id=$1
    local logs=$(gh run view $run_id --log-failed 2>/dev/null || echo "")
    
    if echo "$logs" | grep -q "invalid curve name"; then
        echo "fastlane_curve_error"
    elif echo "$logs" | grep -q "Could not find gem.*fastlane"; then
        echo "fastlane_gem_missing"
    elif echo "$logs" | grep -q "ASC_KEY_ID.*ASC_ISSUER_ID.*ASC_PRIVATE_KEY"; then
        echo "missing_secrets"
    elif echo "$logs" | grep -q "MATCH_PASSWORD\|MATCH_GIT"; then
        echo "missing_match_config"
    elif echo "$logs" | grep -q "Dependencies lock file is not found"; then
        echo "pnpm_lockfile_error"
    else
        echo "unknown_error"
    fi
}

# Wait for new run to start
echo "⏳ Waiting for new workflow run to start..."
sleep 5

# Get initial run info
INITIAL_RUN=$(get_latest_run)
RUN_ID=$(echo "$INITIAL_RUN" | cut -d'|' -f1)
BRANCH=$(echo "$INITIAL_RUN" | cut -d'|' -f6)

echo "📊 Monitoring Run Details:"
echo "   Run ID: $RUN_ID"
echo "   Branch: $BRANCH"
echo "   GitHub: https://github.com/dbirks/capacitor-ai-app/actions/runs/$RUN_ID"
echo ""

# Tracking variables
LAST_STEP=""
STEP_START_TIME=""
PROGRESS_STEPS=(
    "📦 Setup Node.js"
    "📦 Setup pnpm" 
    "📥 Install dependencies"
    "🏗️ Build Capacitor app"
    "💎 Setup Ruby"
    "📱 Sync Capacitor iOS"
    "🔧 Install CocoaPods dependencies"
    "🔐 Setup Keychain"
    "📜 Generate certificates and profiles"
    "🚀 Build and upload to TestFlight"
)

echo "🎯 Expected workflow steps:"
for step in "${PROGRESS_STEPS[@]}"; do
    echo "   $step"
done
echo ""

# Main monitoring loop
while [ $COUNTER -lt $MAX_ITERATIONS ]; do
    CURRENT_RUN=$(get_latest_run)
    CURRENT_RUN_ID=$(echo "$CURRENT_RUN" | cut -d'|' -f1)
    STATUS=$(echo "$CURRENT_RUN" | cut -d'|' -f2)
    CONCLUSION=$(echo "$CURRENT_RUN" | cut -d'|' -f3)
    
    # Check if this is still the same run
    if [ "$CURRENT_RUN_ID" != "$RUN_ID" ]; then
        echo ""
        echo "⚠️  New run detected: $CURRENT_RUN_ID"
        RUN_ID=$CURRENT_RUN_ID
    fi
    
    TIMESTAMP=$(date '+%H:%M:%S')
    
    # Clear line and show status
    printf "\r\033[K"
    
    case $STATUS in
        "queued")
            printf "[$TIMESTAMP] ${YELLOW}🟡 QUEUED${NC} - Waiting for runner..."
            ;;
        "in_progress")
            # Get current step
            STEP_INFO=$(get_step_info $RUN_ID)
            CURRENT_STEP=$(echo "$STEP_INFO" | cut -d'|' -f1)
            STEP_STATUS=$(echo "$STEP_INFO" | cut -d'|' -f2)
            
            if [ -n "$CURRENT_STEP" ] && [ "$CURRENT_STEP" != "$LAST_STEP" ]; then
                printf "\n[$TIMESTAMP] ${BLUE}🔵 NEW STEP:${NC} $CURRENT_STEP"
                LAST_STEP="$CURRENT_STEP"
                STEP_START_TIME=$TIMESTAMP
            elif [ -n "$CURRENT_STEP" ]; then
                printf "[$TIMESTAMP] ${BLUE}🔵 IN PROGRESS:${NC} $CURRENT_STEP"
                if [ -n "$STEP_START_TIME" ]; then
                    printf " (since $STEP_START_TIME)"
                fi
            else
                printf "[$TIMESTAMP] ${BLUE}🔵 RUNNING...${NC}"
            fi
            
            # Highlight critical steps
            if [[ "$CURRENT_STEP" == *"certificates"* ]]; then
                printf " ${YELLOW}🎯 [CRITICAL]${NC}"
            elif [[ "$CURRENT_STEP" == *"Ruby"* ]]; then
                printf " ${YELLOW}💎 [RUBY]${NC}"
            elif [[ "$CURRENT_STEP" == *"Capacitor"* ]]; then
                printf " ${YELLOW}📱 [CAPACITOR]${NC}"
            fi
            ;;
        "completed")
            printf "\n"
            if [ "$CONCLUSION" = "success" ]; then
                echo -e "[$TIMESTAMP] ${GREEN}✅ SUCCESS${NC} - iOS build completed!"
                echo ""
                echo -e "${GREEN}🎉 All fixes worked! Workflow completed successfully!${NC}"
                echo -e "${GREEN}📱 Build would upload to TestFlight (if secrets were configured)${NC}"
                echo ""
                echo "🔗 View run: https://github.com/dbirks/capacitor-ai-app/actions/runs/$RUN_ID"
                exit 0
            elif [ "$CONCLUSION" = "failure" ]; then
                echo -e "[$TIMESTAMP] ${RED}❌ FAILED${NC} - Analyzing failure..."
                echo ""
                
                # Analyze the error
                ERROR_TYPE=$(check_for_errors $RUN_ID)
                
                case $ERROR_TYPE in
                    "fastlane_curve_error")
                        echo -e "${RED}🚨 Fastlane 'invalid curve name' error still occurring${NC}"
                        echo "   📋 This indicates the version pinning didn't work"
                        echo "   🔧 May need to pin to an even older version (2.226.0)"
                        ;;
                    "fastlane_gem_missing")
                        echo -e "${RED}🚨 Fastlane gem dependency issue${NC}"
                        echo "   📋 Bundler can't find the pinned fastlane version"
                        echo "   🔧 Ruby setup step may need adjustment"
                        ;;
                    "missing_secrets")
                        echo -e "${YELLOW}✅ Fastlane fix worked! Now failing on missing secrets (expected)${NC}"
                        echo -e "${GREEN}🎯 Next step: Set up Apple Developer Program and GitHub secrets${NC}"
                        echo ""
                        echo "Required secrets to add in GitHub repository settings:"
                        echo "   • ASC_KEY_ID"
                        echo "   • ASC_ISSUER_ID" 
                        echo "   • ASC_PRIVATE_KEY"
                        echo "   • MATCH_PASSWORD"
                        echo "   • MATCH_GIT_BASIC_AUTHORIZATION"
                        echo "   • MATCH_GIT_URL"
                        ;;
                    "missing_match_config")
                        echo -e "${YELLOW}✅ Good progress! Failing on certificate management config${NC}"
                        echo "   📋 Need to set up certificate repository and Match config"
                        ;;
                    "pnpm_lockfile_error")
                        echo -e "${RED}🚨 pnpm configuration issue${NC}"
                        echo "   📋 Node.js setup still has lockfile problems"
                        ;;
                    *)
                        echo -e "${RED}❓ Unknown error occurred:${NC}"
                        gh run view $RUN_ID --log-failed | head -15
                        ;;
                esac
                
                echo ""
                echo "🔗 Full logs: https://github.com/dbirks/capacitor-ai-app/actions/runs/$RUN_ID"
                exit 1
            else
                echo -e "[$TIMESTAMP] ${YELLOW}⚠️  COMPLETED${NC} - $CONCLUSION"
                exit 1
            fi
            ;;
        *)
            printf "[$TIMESTAMP] ${YELLOW}⚪ $STATUS${NC}"
            ;;
    esac
    
    # Show progress counter
    COUNTER=$((COUNTER + 1))
    MINUTES=$((COUNTER / 6))  # Approximate minutes (10s intervals)
    printf " (${COUNTER}0s"
    if [ $MINUTES -gt 0 ]; then
        printf " / ${MINUTES}m"
    fi
    printf ")"
    
    sleep $POLL_INTERVAL
done

echo ""
echo -e "${RED}⏰ Timeout reached after ${MAX_WAIT_TIME} seconds${NC}"
echo "🔗 Check manually: https://github.com/dbirks/capacitor-ai-app/actions/runs/$RUN_ID"