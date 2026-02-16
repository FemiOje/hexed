use starknet::{ContractAddress, get_tx_info, get_block_timestamp};
use untitled::models::Vec2;
use untitled::constants::constants::GRID_MIN;

/// Generates a pseudo-random spawn position on the hex grid.
/// Produces positions in range [GRID_MIN, GRID_MAX] i.e. [-10, 10].
/// TODO: Switch to VRF for prod
pub fn generate_spawn_position(player: ContractAddress) -> Vec2 {
    let tx_info = get_tx_info().unbox();
    let timestamp = get_block_timestamp();
    let seed: felt252 = timestamp.into() + tx_info.transaction_hash + player.into();
    let seed_u256: u256 = seed.into();
    // Range size = GRID_MAX - GRID_MIN + 1 = 21
    let range: u256 = 21;
    let x_u32: u32 = (seed_u256 % range).try_into().unwrap();
    let y_u32: u32 = ((seed_u256 / range) % range).try_into().unwrap();
    let x: i32 = x_u32.try_into().unwrap() + GRID_MIN;
    let y: i32 = y_u32.try_into().unwrap() + GRID_MIN;
    Vec2 { x, y }
}
