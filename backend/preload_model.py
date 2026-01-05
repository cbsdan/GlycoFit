#!/usr/bin/env python3
"""
Pre-download ML model weights during build phase to avoid timeout during deployment.
This script should be run as part of the build process in Render.
"""

import torch
import torchvision.models as models
import logging
import sys

logging.basicConfig(level=logging.INFO)

def preload_resnet50():
    """Pre-download ResNet50 weights"""
    try:
        logging.info("Starting ResNet50 model download...")
        logging.info("This may take several minutes on first run...")
        
        # Download the model (will be cached)
        model = models.resnet50(pretrained=True)
        
        logging.info("✅ ResNet50 model downloaded successfully!")
        logging.info("Model will be cached and available for the application.")
        return True
    except Exception as e:
        logging.error(f"❌ Failed to download ResNet50 model: {str(e)}")
        return False

if __name__ == "__main__":
    success = preload_resnet50()
    sys.exit(0 if success else 1)
