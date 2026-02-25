#!/bin/bash
set -e

PROFILE="sepolia"
COUNT="${1:-1}"
KEYSTORE="./deployments/keystore.json"

if [ ! -f "$KEYSTORE" ]; then
  echo "Error: Keystore not found at $KEYSTORE"
  echo "Create it with: starkli signer keystore new $KEYSTORE"
  exit 1
fi

# Validate count is a positive integer
if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: ./scripts/spawn_games.sh <count>"
  echo "  count: number of games to spawn (default: 1)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/spawn_games.sh        # spawn 1 game"
  echo "  ./scripts/spawn_games.sh 5      # spawn 5 games"
  echo "  ./scripts/spawn_games.sh 20     # spawn 20 games"
  exit 1
fi

# Build multicall: "hexed-game_systems spawn / hexed-game_systems spawn / ..."
# Uses sozo's native `/` separator so all spawns go in one transaction, one signature.
CALLS=""
for i in $(seq 1 "$COUNT"); do
  if [ -n "$CALLS" ]; then
    CALLS="$CALLS / "
  fi
  CALLS="${CALLS}hexed-game_systems spawn"
done

echo "Spawning $COUNT game(s) on sepolia in a single multicall transaction..."
echo "------------------------------------------------------------------------------"

sozo execute -P "$PROFILE" $CALLS --max-calls "$COUNT" --wait

echo "------------------------------------------------------------------------------"
echo "Done. Spawned $COUNT game(s)."
