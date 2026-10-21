#!/usr/bin/env bash
# Pre-pulls the test images into minikube so a live run doesn't wait on image pulls.
set -euo pipefail
for image in \
  node:22-alpine \
  postman/newman:6-alpine \
  mcr.microsoft.com/playwright:v1.56.1-noble \
  grafana/k6:1.1.0; do
  echo "pulling $image"
  minikube image pull "$image"
done
