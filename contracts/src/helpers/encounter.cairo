use core::hash::HashStateTrait;
use core::poseidon::PoseidonTrait;
use dojo::model::ModelStorage;
use hexed::helpers::combat::{add_xp, handle_player_death};
use hexed::models::{
    BLESSING_HP_AMOUNT, BLESSING_XP_AMOUNT, DRAIN_XP_AMOUNT, EMPOWER_XP_AMOUNT, GIFT_THRESHOLD,
    HEAL_AMOUNT, HEX_HP_AMOUNT, HEX_XP_AMOUNT, POISON_DAMAGE, PlayerStats, Vec2,
};
use starknet::get_block_timestamp;

// ------------------------------------------ //
// ------------ Types ----------------------- //
// ------------------------------------------ //

/// All possible encounter outcomes. Gifts = 0-2, Curses = 3-5.
#[derive(Copy, Drop, PartialEq, Debug)]
pub enum EncounterOutcome {
    #[default]
    Heal,
    Empower,
    Blessing,
    Poison,
    Drain,
    Hex,
}

/// Returned by resolve_encounter so the caller can emit events.
#[derive(Drop, Copy)]
pub struct EncounterResult {
    pub outcome: EncounterOutcome,
    pub player_died: bool,
    pub hp_after: u32,
    pub max_hp_after: u32,
    pub xp_after: u32,
}

// ------------------------------------------ //
// ------------ Trait Impls ----------------- //
// ------------------------------------------ //

pub impl EncounterOutcomeIntoU8 of Into<EncounterOutcome, u8> {
    fn into(self: EncounterOutcome) -> u8 {
        match self {
            EncounterOutcome::Heal => 0,
            EncounterOutcome::Empower => 1,
            EncounterOutcome::Blessing => 2,
            EncounterOutcome::Poison => 3,
            EncounterOutcome::Drain => 4,
            EncounterOutcome::Hex => 5,
        }
    }
}

#[generate_trait]
pub impl EncounterOutcomeImpl of EncounterOutcomeTrait {
    fn is_gift(self: EncounterOutcome) -> bool {
        let val: u8 = self.into();
        val < 3
    }
}

// ------------------------------------------ //
// ------------ Pure Logic ------------------ //
// ------------------------------------------ //

/// Determines encounter outcome from two pre-rolled random values (0-99 each).
pub fn determine_outcome(encounter_roll: u8, subtype_roll: u8) -> EncounterOutcome {
    if encounter_roll < GIFT_THRESHOLD {
        // Gift: Heal 30%, Empower 45%, Blessing 25%
        if subtype_roll < 30 {
            EncounterOutcome::Heal
        } else if subtype_roll < 75 {
            EncounterOutcome::Empower
        } else {
            EncounterOutcome::Blessing
        }
    } else {
        // Curse: Poison 40%, Drain 25%, Hex 35%
        if subtype_roll < 40 {
            EncounterOutcome::Poison
        } else if subtype_roll < 65 {
            EncounterOutcome::Drain
        } else {
            EncounterOutcome::Hex
        }
    }
}

/// Applies an encounter outcome to player stats. Pure function (no world access).
/// Returns true if the player died.
pub fn apply_encounter(ref stats: PlayerStats, outcome: EncounterOutcome) -> bool {
    match outcome {
        EncounterOutcome::Heal => {
            let headroom = stats.max_hp - stats.hp;
            if headroom < HEAL_AMOUNT {
                stats.hp = stats.max_hp;
            } else {
                stats.hp += HEAL_AMOUNT;
            }
        },
        EncounterOutcome::Empower => { add_xp(ref stats, EMPOWER_XP_AMOUNT); },
        EncounterOutcome::Blessing => {
            let headroom = stats.max_hp - stats.hp;
            if headroom < BLESSING_HP_AMOUNT {
                stats.hp = stats.max_hp;
            } else {
                stats.hp += BLESSING_HP_AMOUNT;
            }
            add_xp(ref stats, BLESSING_XP_AMOUNT);
        },
        EncounterOutcome::Poison => {
            if stats.hp <= POISON_DAMAGE {
                stats.hp = 0;
            } else {
                stats.hp -= POISON_DAMAGE;
            }
        },
        EncounterOutcome::Drain => {
            if stats.xp <= DRAIN_XP_AMOUNT {
                stats.xp = 0;
            } else {
                stats.xp -= DRAIN_XP_AMOUNT;
            }
        },
        EncounterOutcome::Hex => {
            // Apply HP damage
            if stats.hp <= HEX_HP_AMOUNT {
                stats.hp = 0;
            } else {
                stats.hp -= HEX_HP_AMOUNT;
            }
            // Apply XP drain
            if stats.xp <= HEX_XP_AMOUNT {
                stats.xp = 0;
            } else {
                stats.xp -= HEX_XP_AMOUNT;
            }
        },
    }

    stats.hp == 0
}

// ------------------------------------------ //
// ------------ World-Aware Logic ----------- //
// ------------------------------------------ //

/// Generates two random rolls (0-99) from game state using Poseidon hash.
fn generate_rolls(game_id: u32, position: Vec2) -> (u8, u8) {
    let timestamp = get_block_timestamp();

    let mut state = PoseidonTrait::new();
    state = state.update(game_id.into());
    state = state.update(position.x.into());
    state = state.update(position.y.into());
    state = state.update(timestamp.into());
    let hash: felt252 = state.finalize();

    let hash_u256: u256 = hash.into();
    let encounter_roll: u8 = (hash_u256 % 100).try_into().unwrap();
    let subtype_roll: u8 = ((hash_u256 / 100) % 100).try_into().unwrap();

    (encounter_roll, subtype_roll)
}

/// Resolves an encounter for a player who just moved to an empty tile.
/// Reads and writes PlayerStats. Handles death cleanup if HP reaches 0.
/// Does NOT emit events — the caller is responsible for that.
pub fn resolve_encounter(
    ref world: dojo::world::WorldStorage, game_id: u32, position: Vec2,
) -> EncounterResult {
    let mut stats: PlayerStats = world.read_model(game_id);

    let (encounter_roll, subtype_roll) = generate_rolls(game_id, position);
    let outcome = determine_outcome(encounter_roll, subtype_roll);
    let player_died = apply_encounter(ref stats, outcome);

    world.write_model(@stats);

    if player_died {
        handle_player_death(ref world, game_id, position, 0);
    }

    EncounterResult {
        outcome, player_died, hp_after: stats.hp, max_hp_after: stats.max_hp, xp_after: stats.xp,
    }
}

// ------------------------------------------ //
// ------------ Unit Tests ------------------ //
// ------------------------------------------ //

#[cfg(test)]
mod tests {
    use hexed::models::{
        EXPLORE_XP_REWARD, HEX_HP_AMOUNT, MAX_HP, POISON_DAMAGE, PlayerStats, STARTING_HP,
    };
    use super::{EncounterOutcome, EncounterOutcomeTrait, apply_encounter, determine_outcome};

    fn fresh_stats(game_id: u32) -> PlayerStats {
        PlayerStats { game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 }
    }

    fn stats_with(game_id: u32, hp: u32, max_hp: u32, xp: u32) -> PlayerStats {
        PlayerStats { game_id, hp, max_hp, xp }
    }

    // ------------------------------------------ //
    // ----- determine_outcome tests ------------ //
    // ------------------------------------------ //

    #[test]
    fn test_gift_heal() {
        // encounter_roll < 65 (gift), subtype_roll < 40 (heal)
        let outcome = determine_outcome(0, 0);
        assert(outcome == EncounterOutcome::Heal, 'should be Heal');
        assert(outcome.is_gift(), 'Heal is a gift');
    }

    #[test]
    fn test_gift_empower() {
        // encounter_roll < 65 (gift), 40 <= subtype_roll < 75 (empower)
        let outcome = determine_outcome(10, 50);
        assert(outcome == EncounterOutcome::Empower, 'should be Empower');
        assert(outcome.is_gift(), 'Empower is a gift');
    }

    #[test]
    fn test_gift_blessing() {
        // encounter_roll < 65 (gift), subtype_roll >= 75 (blessing)
        let outcome = determine_outcome(10, 95);
        assert(outcome == EncounterOutcome::Blessing, 'should be Blessing');
        assert(outcome.is_gift(), 'Blessing is a gift');
    }

    #[test]
    fn test_curse_poison() {
        // encounter_roll >= 65 (curse), subtype_roll < 40 (poison)
        let outcome = determine_outcome(80, 10);
        assert(outcome == EncounterOutcome::Poison, 'should be Poison');
        assert(!outcome.is_gift(), 'Poison is a curse');
    }


    #[test]
    fn test_curse_drain() {
        // encounter_roll >= 50 (curse), 40 <= subtype_roll < 65 (drain)
        let outcome = determine_outcome(99, 50);
        assert(outcome == EncounterOutcome::Drain, 'should be Drain');
    }

    #[test]
    fn test_curse_hex() {
        // encounter_roll >= 50 (curse), subtype_roll >= 65 (hex)
        let outcome = determine_outcome(65, 90);
        assert(outcome == EncounterOutcome::Hex, 'should be Hex');
    }

    #[test]
    fn test_boundary_gift_vs_curse() {
        // encounter_roll = 49 → last gift value
        let gift = determine_outcome(49, 0);
        assert(gift.is_gift(), '49 should be gift');

        // encounter_roll = 50 → first curse value
        let curse = determine_outcome(50, 0);
        assert(!curse.is_gift(), '50 should be curse');
    }

    #[test]
    fn test_subtype_boundaries_gift() {
        // 29 → Heal, 30 → Empower
        assert(determine_outcome(0, 29) == EncounterOutcome::Heal, '29 should be Heal');
        assert(determine_outcome(0, 30) == EncounterOutcome::Empower, '30 should be Empower');
        // 74 → Empower, 75 → Blessing
        assert(determine_outcome(0, 74) == EncounterOutcome::Empower, '74 should be Empower');
        assert(determine_outcome(0, 75) == EncounterOutcome::Blessing, '75 should be Blessing');
        // 99 → Blessing (last value)
        assert(determine_outcome(0, 99) == EncounterOutcome::Blessing, '99 should be Blessing');
    }

    #[test]
    fn test_subtype_boundaries_curse() {
        // 39 → Poison, 40 → Drain
        assert(determine_outcome(80, 39) == EncounterOutcome::Poison, '39 should be Poison');
        assert(determine_outcome(80, 40) == EncounterOutcome::Drain, '40 should be Drain');
        // 64 → Drain, 65 → Hex
        assert(determine_outcome(80, 64) == EncounterOutcome::Drain, '64 should be Drain');
        assert(determine_outcome(80, 65) == EncounterOutcome::Hex, '65 should be Hex');
        // 99 → Hex (last value)
        assert(determine_outcome(80, 99) == EncounterOutcome::Hex, '99 should be Hex');
    }

    // ------------------------------------------ //
    // ----- apply_encounter gift tests --------- //
    // ------------------------------------------ //

    #[test]
    fn test_apply_heal() {
        let mut stats = stats_with(1, 70, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Heal);
        assert(!died, 'heal should not kill');
        assert(stats.hp == 80, 'hp should increase by 10');
    }

    #[test]
    fn test_apply_heal_capped_at_max() {
        let mut stats = stats_with(1, 95, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Heal);
        assert(stats.hp == 100, 'hp capped at max');
    }

    #[test]
    fn test_apply_heal_at_full_hp() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Heal);
        assert(stats.hp == 100, 'hp stays at max');
    }

    #[test]
    fn test_apply_empower() {
        let mut stats = stats_with(1, 100, 100, 50);
        apply_encounter(ref stats, EncounterOutcome::Empower);
        assert(stats.xp == 70, 'xp should increase by 20');
        assert(stats.hp == 100, 'hp unchanged');
    }

    #[test]
    fn test_apply_blessing() {
        let mut stats = stats_with(1, 80, 100, 10);
        apply_encounter(ref stats, EncounterOutcome::Blessing);
        assert(stats.max_hp == 100, 'max_hp unchanged');
        assert(stats.hp == 85, 'hp should increase by 5');
        assert(stats.xp == 20, 'xp should increase by 10');
    }

    #[test]
    fn test_apply_blessing_hp_capped() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Blessing);
        assert(stats.max_hp == 100, 'max_hp unchanged');
        assert(stats.hp == 100, 'hp stays at max');
    }

    // ------------------------------------------ //
    // ----- apply_encounter curse tests -------- //
    // ------------------------------------------ //

    #[test]
    fn test_apply_poison() {
        let mut stats = stats_with(1, 80, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Poison);
        assert(!died, 'should survive');
        assert(stats.hp == 80 - POISON_DAMAGE, 'hp reduced');
    }

    #[test]
    fn test_apply_poison_kills() {
        let mut stats = stats_with(1, 10, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Poison);
        assert(died, 'should die');
        assert(stats.hp == 0, 'hp should be 0');
    }

    #[test]
    fn test_apply_poison_exact_death() {
        let mut stats = stats_with(1, POISON_DAMAGE, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Poison);
        assert(died, 'exact hp = death');
        assert(stats.hp == 0, 'hp should be 0');
    }

    #[test]
    fn test_apply_drain() {
        let mut stats = stats_with(1, 100, 100, 50);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 40, 'xp reduced by 10');
        assert(stats.hp == 100, 'hp unchanged');
    }

    #[test]
    fn test_apply_drain_floor() {
        let mut stats = stats_with(1, 100, 100, 5);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 0, 'xp floored at 0');
    }

    #[test]
    fn test_apply_drain_zero_xp() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 0, 'xp stays at 0');
    }

    #[test]
    fn test_apply_hex() {
        let mut stats = stats_with(1, 80, 100, 50);
        let died = apply_encounter(ref stats, EncounterOutcome::Hex);
        assert(!died, 'should survive');
        assert(stats.max_hp == 100, 'max_hp unchanged');
        assert(stats.hp == 70, 'hp reduced by 10');
        assert(stats.xp == 40, 'xp reduced by 10');
    }

    #[test]
    fn test_apply_hex_kills() {
        let mut stats = stats_with(1, 8, 100, 5);
        let died = apply_encounter(ref stats, EncounterOutcome::Hex);
        assert(died, 'should die from hex');
        assert(stats.hp == 0, 'hp should be 0');
    }

    #[test]
    fn test_apply_hex_all_floors() {
        let mut stats = stats_with(1, 50, 100, 3);
        apply_encounter(ref stats, EncounterOutcome::Hex);
        assert(stats.max_hp == 100, 'max_hp unchanged');
        assert(stats.hp == 50 - HEX_HP_AMOUNT, 'hp reduced by damage');
        assert(stats.xp == 0, 'xp floored at 0');
    }

    // ------------------------------------------ //
    // ----- Encounter outcome trait tests ------ //
    // ------------------------------------------ //

    #[test]
    fn test_outcome_into_u8() {
        let heal_val: u8 = EncounterOutcome::Heal.into();
        let hex_val: u8 = EncounterOutcome::Hex.into();
        assert(heal_val == 0, 'Heal = 0');
        assert(hex_val == 5, 'Hex = 5');
    }

    #[test]
    fn test_is_gift() {
        assert(EncounterOutcome::Heal.is_gift(), 'Heal is gift');
        assert(EncounterOutcome::Empower.is_gift(), 'Empower is gift');
        assert(EncounterOutcome::Blessing.is_gift(), 'Blessing is gift');
        assert(!EncounterOutcome::Poison.is_gift(), 'Poison not gift');
        assert(!EncounterOutcome::Drain.is_gift(), 'Drain not gift');
        assert(!EncounterOutcome::Hex.is_gift(), 'Hex not gift');
    }

    // ------------------------------------------ //
    // ----- Invariant tests -------------------- //
    // ------------------------------------------ //

    #[test]
    fn test_hp_never_exceeds_max_hp_after_gift() {
        // Test all gift outcomes at various HP levels
        let outcomes = array![
            EncounterOutcome::Heal, EncounterOutcome::Empower, EncounterOutcome::Blessing,
        ];
        let hp_levels = array![1_u32, 50, 95, 100];

        let mut i: u32 = 0;
        while i < outcomes.len() {
            let mut j: u32 = 0;
            while j < hp_levels.len() {
                let mut stats = stats_with(1, *hp_levels.at(j), 100, 50);
                apply_encounter(ref stats, *outcomes.at(i));
                assert(stats.hp <= stats.max_hp, 'hp must not exceed max');
                j += 1;
            }
            i += 1;
        }
    }

    #[test]
    fn test_explore_xp_then_drain_net_effect() {
        // Player moves (gets 10 XP from exploration) then gets Drain (-10 XP).
        // Starting at 10 XP: after drain = 0 XP (net effect of one move + one drain).
        let mut stats = stats_with(1, 100, 100, EXPLORE_XP_REWARD);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 0, 'drain after explore = 0');
    }
}
