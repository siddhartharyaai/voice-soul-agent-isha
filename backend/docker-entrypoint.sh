#!/bin/bash

# Deploy script for LiveKit Agents backend
# This should be deployed to Railway, Render, or similar Python hosting platform

echo "Starting LiveKit Voice Agent..."

# Check required environment variables
required_vars=("LIVEKIT_URL" "LIVEKIT_API_KEY" "LIVEKIT_API_SECRET" "DEEPGRAM_API_KEY" "GOOGLE_API_KEY")

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

echo "All environment variables verified"

# Install dependencies
pip install -r requirements.txt

# Run the LiveKit agent
python livekit_agent.py dev