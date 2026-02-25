#!/bin/bash
set -e

PROFILE="sepolia"
KEYSTORE="./deployments/keystore.json"

if [ ! -f "$KEYSTORE" ]; then
  echo "Error: Keystore not found at $KEYSTORE"
  echo "Create it with: starkli signer keystore new $KEYSTORE"
  exit 1
fi

MANIFEST_FILE="./manifest_${PROFILE}.json"
MANIFEST_DEST="../client/src/manifests/manifest_${PROFILE}.json"
BINDINGS_SRC="./bindings/typescript"
BINDINGS_DEST="../client/src/typescript"

#-----------------
# clean
#
echo "------------------------------------------------------------------------------"
echo "Cleaning..."
sozo clean -P "$PROFILE"

#-----------------
# build
#
echo "Building (with TypeScript bindings)..."
sozo build -P "$PROFILE" --typescript

#-----------------
# test
#
echo "Running tests..."
sozo test -P "$PROFILE"

#-----------------
# copy bindings
#
if [ -d "$BINDINGS_SRC" ]; then
  echo "Copying TypeScript bindings..."
  mkdir -p "$BINDINGS_DEST"
  cp -r ${BINDINGS_SRC}/* "$BINDINGS_DEST"
else
  echo "Warning: No bindings found at $BINDINGS_SRC, skipping copy."
fi

#-----------------
# migrate
#
echo ">>> Migrate ($PROFILE)"
sozo migrate -P "$PROFILE"

#-----------------
# copy manifest
#
if [ -f "$MANIFEST_FILE" ]; then
  echo "Copying manifest to client..."
  mkdir -p "$(dirname "$MANIFEST_DEST")"
  cp "$MANIFEST_FILE" "$MANIFEST_DEST"
else
  echo "Warning: Manifest not found at $MANIFEST_FILE, skipping copy."
fi

#-----------------
# inspect
#
echo ">>> Inspect"
sozo inspect -P "$PROFILE"

#-----------------
# get deployed address
#
if [ -f "$MANIFEST_FILE" ]; then
  get_contract_address() {
    local TAG=$1
    local RESULT
    RESULT=$(cat "$MANIFEST_FILE" | jq -r ".contracts[] | select(.tag == \"$TAG\").address")
    if [[ -z "$RESULT" ]]; then
      >&2 echo "get_contract_address($TAG) not found!"
    fi
    echo "$RESULT"
  }

  GAME_SYSTEMS_ADDRESS=$(get_contract_address "hexed-game_systems")

  echo "------------------------------------------------------------------------------"
  echo "GAME SYSTEMS ADDRESS: $GAME_SYSTEMS_ADDRESS"
fi

echo "------------------------------------------------------------------------------"
echo "Deploy complete (sepolia)."
