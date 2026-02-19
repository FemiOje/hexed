use core::hash::HashStateTrait;
use core::poseidon::PoseidonTrait;
use dojo::model::ModelStorage;
use starknet::get_block_timestamp;
use untitled::helpers::combat::{add_xp, handle_player_death};
use untitled::models::{
    BLESSING_HP_AMOUNT, BLESSING_MAX_HP_AMOUNT, BLESSING_XP_AMOUNT, DRAIN_XP_AMOUNT,
    EMPOWER_XP_AMOUNT, FORTIFY_HP_AMOUNT, FORTIFY_MAX_HP_AMOUNT, GIFT_THRESHOLD, HEAL_AMOUNT,
    HEX_HP_AMOUNT, HEX_MAX_HP_AMOUNT, HEX_XP_AMOUNT, MIN_MAX_HP, POISON_DAMAGE, PlayerStats, Vec2,
    WITHER_MAX_HP_AMOUNT,
};

// ------------------------------------------ //
// ------------ Types ----------------------- //
// ------------------------------------------ //

/// All possible encounter outcomes. Gifts = 0-3, Curses = 4-7.
#[derive(Copy, Drop, PartialEq, Debug)]
pub enum EncounterOutcome {
    #[default]
    Heal,
    Fortify,
    Empower,
    Blessing,
    Poison,
    Wither,
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
            EncounterOutcome::Fortify => 1,
            EncounterOutcome::Empower => 2,
            EncounterOutcome::Blessing => 3,
            EncounterOutcome::Poison => 4,
            EncounterOutcome::Wither => 5,
            EncounterOutcome::Drain => 6,
            EncounterOutcome::Hex => 7,
        }
    }
}

#[generate_trait]
pub impl EncounterOutcomeImpl of EncounterOutcomeTrait {
    fn is_gift(self: EncounterOutcome) -> bool {
        let val: u8 = self.into();
        val < 4
    }
}

// ------------------------------------------ //
// ------------ Pure Logic ------------------ //
// ------------------------------------------ //

/// Determines encounter outcome from two pre-rolled random values (0-99 each).
pub fn determine_outcome(encounter_roll: u8, subtype_roll: u8) -> EncounterOutcome {
    if encounter_roll < GIFT_THRESHOLD {
        // Gift: Heal 40%, Fortify 25%, Empower 25%, Blessing 10%
        if subtype_roll < 40 {
            EncounterOutcome::Heal
        } else if subtype_roll < 65 {
            EncounterOutcome::Fortify
        } else if subtype_roll < 90 {
            EncounterOutcome::Empower
        } else {
            EncounterOutcome::Blessing
        }
    } else {
        // Curse: Poison 40%, Wither 25%, Drain 25%, Hex 10%
        if subtype_roll < 40 {
            EncounterOutcome::Poison
        } else if subtype_roll < 65 {
            EncounterOutcome::Wither
        } else if subtype_roll < 90 {
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
        EncounterOutcome::Fortify => {
            stats.max_hp += FORTIFY_MAX_HP_AMOUNT;
            stats.hp += FORTIFY_HP_AMOUNT;
        },
        EncounterOutcome::Empower => {
            add_xp(ref stats, EMPOWER_XP_AMOUNT);
        },
        EncounterOutcome::Blessing => {
            stats.max_hp += BLESSING_MAX_HP_AMOUNT;
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
        EncounterOutcome::Wither => {
            if stats.max_hp <= MIN_MAX_HP + WITHER_MAX_HP_AMOUNT {
                stats.max_hp = MIN_MAX_HP;
            } else {
                stats.max_hp -= WITHER_MAX_HP_AMOUNT;
            }
            if stats.hp > stats.max_hp {
                stats.hp = stats.max_hp;
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
            // Reduce max_hp first
            if stats.max_hp <= MIN_MAX_HP + HEX_MAX_HP_AMOUNT {
                stats.max_hp = MIN_MAX_HP;
            } else {
                stats.max_hp -= HEX_MAX_HP_AMOUNT;
            }
            // Clamp hp to new max
            if stats.hp > stats.max_hp {
                stats.hp = stats.max_hp;
            }
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
    use untitled::models::{
        BLESSING_HP_AMOUNT, BLESSING_MAX_HP_AMOUNT, BLESSING_XP_AMOUNT, DRAIN_XP_AMOUNT,
        EMPOWER_XP_AMOUNT, EXPLORE_XP_REWARD, FORTIFY_HP_AMOUNT, FORTIFY_MAX_HP_AMOUNT,
        HEAL_AMOUNT, HEX_HP_AMOUNT, HEX_MAX_HP_AMOUNT, HEX_XP_AMOUNT, MAX_HP, MIN_MAX_HP,
        POISON_DAMAGE, PlayerStats, STARTING_HP, WITHER_MAX_HP_AMOUNT,
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
    fn test_gift_fortify() {
        // encounter_roll < 65 (gift), 40 <= subtype_roll < 65 (fortify)
        let outcome = determine_outcome(30, 50);
        assert(outcome == EncounterOutcome::Fortify, 'should be Fortify');
        assert(outcome.is_gift(), 'Fortify is a gift');
    }

    #[test]
    fn test_gift_empower() {
        // encounter_roll < 65 (gift), 65 <= subtype_roll < 90 (empower)
        let outcome = determine_outcome(10, 70);
        assert(outcome == EncounterOutcome::Empower, 'should be Empower');
    }

    #[test]
    fn test_gift_blessing() {
        // encounter_roll < 65 (gift), subtype_roll >= 90 (blessing)
        let outcome = determine_outcome(10, 95);
        assert(outcome == EncounterOutcome::Blessing, 'should be Blessing');
    }

    #[test]
    fn test_curse_poison() {
        // encounter_roll >= 65 (curse), subtype_roll < 40 (poison)
        let outcome = determine_outcome(80, 10);
        assert(outcome == EncounterOutcome::Poison, 'should be Poison');
        assert(!outcome.is_gift(), 'Poison is a curse');
    }

    #[test]
    fn test_curse_wither() {
        // encounter_roll >= 65 (curse), 40 <= subtype_roll < 65 (wither)
        let outcome = determine_outcome(70, 50);
        assert(outcome == EncounterOutcome::Wither, 'should be Wither');
    }

    #[test]
    fn test_curse_drain() {
        // encounter_roll >= 65 (curse), 65 <= subtype_roll < 90 (drain)
        let outcome = determine_outcome(99, 80);
        assert(outcome == EncounterOutcome::Drain, 'should be Drain');
    }

    #[test]
    fn test_curse_hex() {
        // encounter_roll >= 65 (curse), subtype_roll >= 90 (hex)
        let outcome = determine_outcome(65, 99);
        assert(outcome == EncounterOutcome::Hex, 'should be Hex');
    }

    #[test]
    fn test_boundary_gift_vs_curse() {
        // encounter_roll = 64 → last gift value
        let gift = determine_outcome(64, 0);
        assert(gift.is_gift(), '64 should be gift');

        // encounter_roll = 65 → first curse value
        let curse = determine_outcome(65, 0);
        assert(!curse.is_gift(), '65 should be curse');
    }

    #[test]
    fn test_subtype_boundaries_gift() {
        // 39 → Heal, 40 → Fortify
        assert(determine_outcome(0, 39) == EncounterOutcome::Heal, '39 should be Heal');
        assert(determine_outcome(0, 40) == EncounterOutcome::Fortify, '40 should be Fortify');
        // 64 → Fortify, 65 → Empower
        assert(determine_outcome(0, 64) == EncounterOutcome::Fortify, '64 should be Fortify');
        assert(determine_outcome(0, 65) == EncounterOutcome::Empower, '65 should be Empower');
        // 89 → Empower, 90 → Blessing
        assert(determine_outcome(0, 89) == EncounterOutcome::Empower, '89 should be Empower');
        assert(determine_outcome(0, 90) == EncounterOutcome::Blessing, '90 should be Blessing');
    }

    #[test]
    fn test_subtype_boundaries_curse() {
        // 39 → Poison, 40 → Wither
        assert(determine_outcome(80, 39) == EncounterOutcome::Poison, '39 should be Poison');
        assert(determine_outcome(80, 40) == EncounterOutcome::Wither, '40 should be Wither');
        // 64 → Wither, 65 → Drain
        assert(determine_outcome(80, 64) == EncounterOutcome::Wither, '64 should be Wither');
        assert(determine_outcome(80, 65) == EncounterOutcome::Drain, '65 should be Drain');
        // 89 → Drain, 90 → Hex
        assert(determine_outcome(80, 89) == EncounterOutcome::Drain, '89 should be Drain');
        assert(determine_outcome(80, 90) == EncounterOutcome::Hex, '90 should be Hex');
    }

    // ------------------------------------------ //
    // ----- apply_encounter gift tests --------- //
    // ------------------------------------------ //

    #[test]
    fn test_apply_heal() {
        let mut stats = stats_with(1, 70, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Heal);
        assert(!died, 'heal should not kill');
        assert(stats.hp == 70 + HEAL_AMOUNT, 'hp should increase');
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
    fn test_apply_fortify() {
        let mut stats = stats_with(1, 80, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Fortify);
        assert(stats.max_hp == 100 + FORTIFY_MAX_HP_AMOUNT, 'max_hp should increase');
        assert(stats.hp == 80 + FORTIFY_HP_AMOUNT, 'hp should increase');
        assert(stats.hp <= stats.max_hp, 'hp should not exceed max');
    }

    #[test]
    fn test_apply_fortify_at_full_hp() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Fortify);
        assert(stats.max_hp == 110, 'max_hp grows');
        assert(stats.hp == 110, 'hp grows with max');
    }

    #[test]
    fn test_apply_empower() {
        let mut stats = stats_with(1, 100, 100, 50);
        apply_encounter(ref stats, EncounterOutcome::Empower);
        assert(stats.xp == 50 + EMPOWER_XP_AMOUNT, 'xp should increase');
        assert(stats.hp == 100, 'hp unchanged');
    }

    #[test]
    fn test_apply_blessing() {
        let mut stats = stats_with(1, 80, 100, 10);
        apply_encounter(ref stats, EncounterOutcome::Blessing);
        assert(stats.max_hp == 100 + BLESSING_MAX_HP_AMOUNT, 'max_hp should increase');
        assert(stats.hp == 80 + BLESSING_HP_AMOUNT, 'hp should increase');
        assert(stats.xp == 10 + BLESSING_XP_AMOUNT, 'xp should increase');
    }

    #[test]
    fn test_apply_blessing_hp_capped() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Blessing);
        assert(stats.max_hp == 105, 'max_hp grows by 5');
        assert(stats.hp == 105, 'hp capped at new max');
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
    fn test_apply_wither() {
        let mut stats = stats_with(1, 80, 100, 0);
        let died = apply_encounter(ref stats, EncounterOutcome::Wither);
        assert(!died, 'should survive');
        assert(stats.max_hp == 100 - WITHER_MAX_HP_AMOUNT, 'max_hp reduced');
        assert(stats.hp == 80, 'hp unchanged (below new max)');
    }

    #[test]
    fn test_apply_wither_clamps_hp() {
        let mut stats = stats_with(1, 100, 100, 0);
        apply_encounter(ref stats, EncounterOutcome::Wither);
        assert(stats.max_hp == 90, 'max_hp reduced');
        assert(stats.hp == 90, 'hp clamped to new max');
    }

    #[test]
    fn test_apply_wither_floor() {
        let mut stats = stats_with(1, 15, 15, 0);
        apply_encounter(ref stats, EncounterOutcome::Wither);
        assert(stats.max_hp == MIN_MAX_HP, 'max_hp at floor');
        assert(stats.hp == MIN_MAX_HP, 'hp clamped to floor');
    }

    #[test]
    fn test_apply_wither_already_at_floor() {
        let mut stats = stats_with(1, 10, MIN_MAX_HP, 0);
        apply_encounter(ref stats, EncounterOutcome::Wither);
        assert(stats.max_hp == MIN_MAX_HP, 'max_hp stays at floor');
        assert(stats.hp == MIN_MAX_HP, 'hp stays at floor');
    }

    #[test]
    fn test_apply_drain() {
        let mut stats = stats_with(1, 100, 100, 50);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 50 - DRAIN_XP_AMOUNT, 'xp reduced');
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
        assert(stats.max_hp == 100 - HEX_MAX_HP_AMOUNT, 'max_hp reduced');
        assert(stats.hp == 80 - HEX_HP_AMOUNT, 'hp reduced');
        assert(stats.xp == 50 - HEX_XP_AMOUNT, 'xp reduced');
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
        let mut stats = stats_with(1, 50, MIN_MAX_HP + 2, 3);
        apply_encounter(ref stats, EncounterOutcome::Hex);
        assert(stats.max_hp == MIN_MAX_HP, 'max_hp at floor');
        // hp was 50, clamped to min_max_hp (10), then -10 = 0
        assert(stats.hp == 0, 'hp should be 0');
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
        assert(hex_val == 7, 'Hex = 7');
    }

    #[test]
    fn test_is_gift() {
        assert(EncounterOutcome::Heal.is_gift(), 'Heal is gift');
        assert(EncounterOutcome::Fortify.is_gift(), 'Fortify is gift');
        assert(EncounterOutcome::Empower.is_gift(), 'Empower is gift');
        assert(EncounterOutcome::Blessing.is_gift(), 'Blessing is gift');
        assert(!EncounterOutcome::Poison.is_gift(), 'Poison not gift');
        assert(!EncounterOutcome::Wither.is_gift(), 'Wither not gift');
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
            EncounterOutcome::Heal,
            EncounterOutcome::Fortify,
            EncounterOutcome::Empower,
            EncounterOutcome::Blessing,
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
            };
            i += 1;
        }
    }

    #[test]
    fn test_max_hp_never_below_floor_after_curse() {
        let outcomes = array![EncounterOutcome::Wither, EncounterOutcome::Hex];
        let max_hp_levels = array![MIN_MAX_HP, MIN_MAX_HP + 1, MIN_MAX_HP + 5, 20_u32, 100];

        let mut i: u32 = 0;
        while i < outcomes.len() {
            let mut j: u32 = 0;
            while j < max_hp_levels.len() {
                let mhp = *max_hp_levels.at(j);
                let mut stats = stats_with(1, mhp, mhp, 50);
                apply_encounter(ref stats, *outcomes.at(i));
                assert(stats.max_hp >= MIN_MAX_HP, 'max_hp below floor');
                j += 1;
            };
            i += 1;
        }
    }

    #[test]
    fn test_explore_xp_then_drain_net_effect() {
        // Player moves (gets 10 XP from exploration) then gets Drain (-20 XP).
        // Starting at 0 XP: after explore = 10, after drain = 0 (floor).
        let mut stats = stats_with(1, 100, 100, EXPLORE_XP_REWARD);
        apply_encounter(ref stats, EncounterOutcome::Drain);
        assert(stats.xp == 0, 'drain after explore = 0');
    }
}
