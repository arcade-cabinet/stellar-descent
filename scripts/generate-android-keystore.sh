#!/bin/bash
#
# Generate Android debug keystore for signing APKs
#
# This creates a debug keystore that can be used for testing builds.
# For production releases, you should use a proper release keystore.
#
# Usage: ./scripts/generate-android-keystore.sh
#
# After generation, add the base64-encoded keystore as a GitHub secret:
#   ANDROID_KEYSTORE_BASE64: base64-encoded content of the .jks file
#   ANDROID_KEYSTORE_PASSWORD: the password you set (default: stellardescent)
#   ANDROID_KEY_ALIAS: stellardescent-debug
#   ANDROID_KEY_PASSWORD: the password you set (default: stellardescent)

set -e

KEYSTORE_DIR="android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/debug-keystore.jks"
ALIAS="stellardescent-debug"
PASSWORD="${1:-stellardescent}"
VALIDITY=10000 # ~27 years

echo "=== Android Debug Keystore Generator ==="
echo ""

# Create directory if it doesn't exist
mkdir -p "$KEYSTORE_DIR"

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo "Keystore already exists at $KEYSTORE_FILE"
    echo "Remove it first if you want to generate a new one."
    exit 1
fi

echo "Generating keystore with:"
echo "  File: $KEYSTORE_FILE"
echo "  Alias: $ALIAS"
echo "  Password: $PASSWORD"
echo "  Validity: $VALIDITY days"
echo ""

# Generate the keystore
keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_FILE" \
    -storepass "$PASSWORD" \
    -keypass "$PASSWORD" \
    -alias "$ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY" \
    -dname "CN=Stellar Descent Debug, OU=Development, O=jbcom, L=San Francisco, S=California, C=US"

echo ""
echo "=== Keystore generated successfully! ==="
echo ""
echo "To use in GitHub Actions, add these secrets:"
echo ""
echo "1. ANDROID_KEYSTORE_BASE64:"
echo "   base64 -i $KEYSTORE_FILE | pbcopy  # Copies to clipboard on macOS"
echo "   Or: base64 $KEYSTORE_FILE | tr -d '\\n'"
echo ""
echo "2. ANDROID_KEYSTORE_PASSWORD: $PASSWORD"
echo "3. ANDROID_KEY_ALIAS: $ALIAS"
echo "4. ANDROID_KEY_PASSWORD: $PASSWORD"
echo ""
echo "The base64 output is:"
echo "---"
base64 -i "$KEYSTORE_FILE"
echo "---"
