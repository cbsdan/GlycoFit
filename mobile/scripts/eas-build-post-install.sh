#!/bin/bash

# Fix AGP version to 8.3.2 (runs after npm install)
echo "Fixing Android Gradle Plugin version to 8.3.2..."

if [ -f "android/build.gradle" ]; then
  # Replace any AGP classpath declaration with version 8.3.2
  sed -i.bak "s/classpath(['\"]com\.android\.tools\.build:gradle['\"])/classpath('com.android.tools.build:gradle:8.3.2')/g" android/build.gradle
  sed -i.bak "s/classpath(['\"]com\.android\.tools\.build:gradle:[^'\"]*['\"])/classpath('com.android.tools.build:gradle:8.3.2')/g" android/build.gradle
  
  echo "✅ AGP version set to 8.3.2 in android/build.gradle"
  grep "gradle:8.3.2" android/build.gradle && echo "✅ Verified: AGP 8.3.2 is set" || echo "❌ Warning: Could not verify AGP version"
else
  echo "❌ Error: android/build.gradle not found"
  exit 1
fi
