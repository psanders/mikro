#!/bin/bash
# Build @mikro/common so dist/ exists for Metro bundling
cd ../../mods/common && npx tsc -b --force
