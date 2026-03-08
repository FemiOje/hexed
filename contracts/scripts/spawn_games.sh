#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# spawn_games.sh — Mint EGS tokens + Spawn Hex'd games on Sepolia
#
# Uses batched multicalls to minimize signing:
#   1. MINT  — batch-mint all N tokens in one multicall (1 signature)
#   2. SPAWN — batch-spawn games in chunks of SPAWN_BATCH_SIZE per multicall
#              (each spawn emits ~8 events; Starknet limits 1000 events/tx)
# ---------------------------------------------------------------------------

PROFILE="sepolia"
COUNT="${1:-1}"
KEYSTORE="./deployments/keystore.json"
MANIFEST_FILE="./manifest_${PROFILE}.json"

# Denshokan token contract on Sepolia
TOKEN_CONTRACT="0x0142712722e62a38f9c40fcc904610e1a14c70125876ecaaf25d803556734467"

# Each spawn emits ~8 events (5 model writes + Spawned + NeighborsRevealed + EGS hooks).
# Starknet caps at 1000 events per transaction → max ~125 spawns per tx.
# Use 100 for safety margin.
SPAWN_BATCH_SIZE=100

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------

if [ ! -f "$KEYSTORE" ]; then
  echo "Error: Keystore not found at $KEYSTORE"
  echo "Create it with: starkli signer keystore new $KEYSTORE"
  exit 1
fi

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Error: Manifest not found at $MANIFEST_FILE"
  echo "Run: scarb run migrate  (to deploy first)"
  exit 1
fi

if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: ./scripts/spawn_games.sh [count]"
  echo "  count: number of games to spawn (default: 1)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/spawn_games.sh        # mint + spawn 1 game"
  echo "  ./scripts/spawn_games.sh 5      # mint + spawn 5 games"
  echo "  ./scripts/spawn_games.sh 20     # mint + spawn 20 games"
  exit 1
fi

# ---------------------------------------------------------------------------
# Read addresses from manifest and dojo config
# ---------------------------------------------------------------------------

get_contract_address() {
  local TAG=$1
  python3 -c "
import json, sys
with open('$MANIFEST_FILE') as f:
    data = json.load(f)
for c in data.get('contracts', []):
    if c.get('tag') == '$TAG':
        print(c['address'])
        sys.exit(0)
print('', end='')
sys.exit(1)
"
}

GAME_TOKEN_SYSTEMS=$(get_contract_address "hexed-game_token_systems")
if [ -z "$GAME_TOKEN_SYSTEMS" ]; then
  echo "Error: hexed-game_token_systems not found in $MANIFEST_FILE"
  exit 1
fi

# Read account address from dojo profile config
ACCOUNT_ADDRESS=$(python3 -c "
import sys
for line in open('dojo_${PROFILE}.toml'):
    line = line.strip()
    if line.startswith('account_address'):
        val = line.split('=', 1)[1].strip().strip('\"')
        print(val)
        sys.exit(0)
sys.exit(1)
" 2>/dev/null)

if [ -z "$ACCOUNT_ADDRESS" ]; then
  echo "Error: account_address not found in dojo_${PROFILE}.toml"
  exit 1
fi

# Calculate number of spawn batches needed
SPAWN_BATCHES=$(( (COUNT + SPAWN_BATCH_SIZE - 1) / SPAWN_BATCH_SIZE ))
TOTAL_TXS=$(( 1 + SPAWN_BATCHES ))

echo "=============================================================================="
echo "  Hex'd — Mint + Spawn Games"
echo "=============================================================================="
echo "  Profile:            $PROFILE"
echo "  Count:              $COUNT"
echo "  Token Contract:     $TOKEN_CONTRACT"
echo "  Game Token Systems: $GAME_TOKEN_SYSTEMS"
echo "  Account:            $ACCOUNT_ADDRESS"
echo "  Spawn batch size:   $SPAWN_BATCH_SIZE"
echo "  Total transactions: $TOTAL_TXS (1 mint + $SPAWN_BATCHES spawn)"
echo "=============================================================================="

# ---------------------------------------------------------------------------
# Step 1: Batch-mint all tokens in one multicall
# ---------------------------------------------------------------------------
# mint() calldata per call (all Options = None):
#
#   game_address:     GAME_TOKEN_SYSTEMS  (ContractAddress)
#   player_name:      1                   (Option::None)
#   settings_id:      1                   (Option::None)
#   start:            1                   (Option::None)
#   end:              1                   (Option::None)
#   objective_id:     1                   (Option::None)
#   context:          1                   (Option::None)
#   client_url:       1                   (Option::None)
#   renderer_address: 1                   (Option::None)
#   skills_address:   1                   (Option::None)
#   to:               ACCOUNT_ADDRESS     (ContractAddress)
#   soulbound:        0                   (bool false)
#   paymaster:        0                   (bool false)
#   salt:             <unique>            (u16)
#   metadata:         0                   (u16)
# ---------------------------------------------------------------------------

MINT_CALLS=""
for i in $(seq 1 "$COUNT"); do
  if [ -n "$MINT_CALLS" ]; then
    MINT_CALLS="$MINT_CALLS / "
  fi
  MINT_CALLS="${MINT_CALLS}${TOKEN_CONTRACT} mint ${GAME_TOKEN_SYSTEMS} 1 1 1 1 1 1 1 1 1 ${ACCOUNT_ADDRESS} 0 0 ${i} 0"
done

echo ""
echo "[1/$TOTAL_TXS] Minting $COUNT token(s) in a single multicall..."
echo "------------------------------------------------------------------------------"

MINT_OUTPUT=""
if MINT_OUTPUT=$(sozo execute -P "$PROFILE" \
  $MINT_CALLS \
  --max-calls "$COUNT" --wait --receipt 2>&1); then
  :
else
  echo "Error: Mint multicall failed"
  echo "$MINT_OUTPUT" | tail -10
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Extract all token_ids from Transfer events
# ---------------------------------------------------------------------------

TOKEN_IDS=$(echo "$MINT_OUTPUT" | python3 -c "
import sys, json

data = sys.stdin.read()

TRANSFER_SELECTOR = '0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9'

# sozo --receipt prefixes output with 'Transaction hash: ...\nReceipt: '
json_start = data.find('{')
if json_start == -1:
    sys.exit(1)
json_data = data[json_start:]

try:
    receipt = json.loads(json_data)
    events = receipt.get('events', [])

    token_ids = []
    for event in events:
        keys = event.get('keys', [])
        if len(keys) >= 5 and keys[0] == TRANSFER_SELECTOR:
            low = int(keys[3], 16)
            high = int(keys[4], 16)
            token_id = high * (2 ** 128) + low
            token_ids.append(hex(token_id))

    if not token_ids:
        sys.exit(1)

    for tid in token_ids:
        print(tid)
except (json.JSONDecodeError, KeyError, ValueError):
    sys.exit(1)
" 2>/dev/null) || true

if [ -z "$TOKEN_IDS" ]; then
  echo "Error: Failed to extract token_ids from mint receipt"
  echo "Receipt (first 40 lines):"
  echo "$MINT_OUTPUT" | head -40
  exit 1
fi

# Convert newline-separated token_ids into an array
readarray -t TOKEN_ID_ARRAY <<< "$TOKEN_IDS"
MINTED=${#TOKEN_ID_ARRAY[@]}

echo "Minted $MINTED token(s)."

if [ "$MINTED" -ne "$COUNT" ]; then
  echo "Warning: Expected $COUNT token(s) but found $MINTED in receipt"
fi

# ---------------------------------------------------------------------------
# Step 3: Spawn in batches (max SPAWN_BATCH_SIZE per multicall)
# ---------------------------------------------------------------------------

SPAWNED=0
BATCH_NUM=0

while [ "$SPAWNED" -lt "$MINTED" ]; do
  BATCH_NUM=$((BATCH_NUM + 1))
  BATCH_END=$((SPAWNED + SPAWN_BATCH_SIZE))
  if [ "$BATCH_END" -gt "$MINTED" ]; then
    BATCH_END=$MINTED
  fi
  BATCH_COUNT=$((BATCH_END - SPAWNED))
  TX_NUM=$((1 + BATCH_NUM))

  # Build multicall for this batch
  SPAWN_CALLS=""
  for j in $(seq "$SPAWNED" "$((BATCH_END - 1))"); do
    if [ -n "$SPAWN_CALLS" ]; then
      SPAWN_CALLS="$SPAWN_CALLS / "
    fi
    SPAWN_CALLS="${SPAWN_CALLS}hexed-game_systems spawn ${TOKEN_ID_ARRAY[$j]}"
  done

  echo ""
  echo "[$TX_NUM/$TOTAL_TXS] Spawning games $((SPAWNED + 1))-${BATCH_END} ($BATCH_COUNT in this batch)..."
  echo "------------------------------------------------------------------------------"

  if sozo execute -P "$PROFILE" \
    $SPAWN_CALLS \
    --max-calls "$BATCH_COUNT" --wait; then
    SPAWNED=$BATCH_END
  else
    echo ""
    echo "Error: Spawn batch $BATCH_NUM failed (games $((SPAWNED + 1))-${BATCH_END})"
    echo "Successfully spawned $SPAWNED/$MINTED games before failure."
    exit 1
  fi
done

echo "------------------------------------------------------------------------------"
echo ""
echo "=============================================================================="
echo "  Done. $MINTED game(s) minted + spawned in $TOTAL_TXS transaction(s)."
echo "=============================================================================="
