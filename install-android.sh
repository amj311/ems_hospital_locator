#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Android Deployment..."

# 1. Build the Vue web app
echo "📦 Building Vue application..."
yarn build-only

# 2. Copy the web build to the Capacitor android folder
echo "📁 Copying web assets to Android..."
npx cap copy android

# 3. Sync plugins and native dependencies
echo "🔄 Syncing Capacitor plugins..."
npx cap sync android

# 4. Build the APK using Gradle
# We use 'cd android' to run the gradle wrapper directly
echo "🛠️  Building APK via Gradle..."
cd android
./gradlew assembleDebug
cd ..

# 5. Install the generated APK via ADB
echo "📲 Installing APK to device via ADB..."
# The default path for the debug APK
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    adb install -r "$APK_PATH"
    echo "✅ Deployment Successful!"
else
    echo "❌ Error: APK not found at $APK_PATH"
    exit 1
fi
