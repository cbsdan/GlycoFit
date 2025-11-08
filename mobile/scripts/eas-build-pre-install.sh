#!/bin/bash

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "Creating google-services.json from environment variable..."
  echo $GOOGLE_SERVICES_JSON | base64 -d > google-services.json
  echo "google-services.json created successfully"
else
  echo "Warning: GOOGLE_SERVICES_JSON environment variable not set"
fi