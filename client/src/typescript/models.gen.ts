import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { CairoCustomEnum, CairoOption, CairoOptionVariant, BigNumberish } from 'starknet';

// Type definition for `hexed::models::GameCounter` struct
export interface GameCounter {
	token_id: BigNumberish;
	active_games: BigNumberish;
}

// Type definition for `hexed::models::GameSession` struct
export interface GameSession {
	token_id: BigNumberish;
	player: string;
	is_active: boolean;
}

// Type definition for `hexed::models::HighestScore` struct
export interface HighestScore {
	token_id: BigNumberish;
	player: string;
	username: BigNumberish;
	xp: BigNumberish;
}

// Type definition for `hexed::models::PlayerState` struct
export interface PlayerState {
	token_id: BigNumberish;
	position: Vec2;
	last_direction: CairoOption<DirectionEnum>;
	can_move: boolean;
}

// Type definition for `hexed::models::PlayerStats` struct
export interface PlayerStats {
	token_id: BigNumberish;
	hp: BigNumberish;
	max_hp: BigNumberish;
	xp: BigNumberish;
}

// Type definition for `hexed::models::TileOccupant` struct
export interface TileOccupant {
	x: BigNumberish;
	y: BigNumberish;
	token_id: BigNumberish;
}

// Type definition for `hexed::models::Vec2` struct
export interface Vec2 {
	x: BigNumberish;
	y: BigNumberish;
}

// Type definition for `hexed::systems::game::contracts::game_systems::CombatResult` struct
export interface CombatResult {
	attacker_token_id: BigNumberish;
	defender_token_id: BigNumberish;
	attacker_won: boolean;
	attacker_position: Vec2;
	defender_position: Vec2;
	damage_dealt: BigNumberish;
	retaliation_damage: BigNumberish;
	xp_awarded: BigNumberish;
	hp_reward: BigNumberish;
	attacker_died: boolean;
	defender_died: boolean;
}

// Type definition for `hexed::systems::game::contracts::game_systems::EncounterOccurred` struct
export interface EncounterOccurred {
	token_id: BigNumberish;
	is_gift: boolean;
	outcome: BigNumberish;
	hp_after: BigNumberish;
	max_hp_after: BigNumberish;
	xp_after: BigNumberish;
	player_died: boolean;
}

// Type definition for `hexed::systems::game::contracts::game_systems::HighestScoreUpdated` struct
export interface HighestScoreUpdated {
	player: string;
	username: BigNumberish;
	xp: BigNumberish;
}

// Type definition for `hexed::systems::game::contracts::game_systems::Moved` struct
export interface Moved {
	token_id: BigNumberish;
	direction: DirectionEnum;
	position: Vec2;
}

// Type definition for `hexed::systems::game::contracts::game_systems::NeighborsRevealed` struct
export interface NeighborsRevealed {
	token_id: BigNumberish;
	position: Vec2;
	neighbors: BigNumberish;
}

// Type definition for `hexed::systems::game::contracts::game_systems::PlayerDied` struct
export interface PlayerDied {
	token_id: BigNumberish;
	killed_by: BigNumberish;
	position: Vec2;
}

// Type definition for `hexed::systems::game::contracts::game_systems::Spawned` struct
export interface Spawned {
	token_id: BigNumberish;
	player: string;
	position: Vec2;
}

// Type definition for `game_components_interfaces::structs::metagame::GameContext` struct
export interface GameContext {
	name: BigNumberish;
	value: BigNumberish;
}

// Type definition for `game_components_interfaces::structs::metagame::GameContextDetails` struct
export interface GameContextDetails {
	name: string;
	description: string;
	id: CairoOption<BigNumberish>;
	context: Array<GameContext>;
}

// Type definition for `game_components_interfaces::structs::minigame::GameDetail` struct
export interface GameDetail {
	name: BigNumberish;
	value: BigNumberish;
}

// Type definition for `game_components_interfaces::structs::minigame::MintGameParams` struct
export interface MintGameParams {
	player_name: CairoOption<BigNumberish>;
	settings_id: CairoOption<BigNumberish>;
	start: CairoOption<BigNumberish>;
	end: CairoOption<BigNumberish>;
	objective_id: CairoOption<BigNumberish>;
	context: CairoOption<GameContextDetails>;
	client_url: CairoOption<string>;
	renderer_address: CairoOption<string>;
	skills_address: CairoOption<string>;
	to: string;
	soulbound: boolean;
	paymaster: boolean;
	salt: BigNumberish;
	metadata: BigNumberish;
}

// Type definition for `hexed::models::GameState` struct
export interface GameState {
	token_id: BigNumberish;
	player: string;
	position: Vec2;
	last_direction: CairoOption<DirectionEnum>;
	can_move: boolean;
	is_active: boolean;
	hp: BigNumberish;
	max_hp: BigNumberish;
	xp: BigNumberish;
	neighbor_occupancy: BigNumberish;
}

// Type definition for `hexed::models::Direction` enum
export const direction = [
	'East',
	'NorthEast',
	'NorthWest',
	'West',
	'SouthWest',
	'SouthEast',
] as const;
export type Direction = { [key in typeof direction[number]]: string };
export type DirectionEnum = CairoCustomEnum;

export interface SchemaType extends ISchemaType {
	hexed: {
		GameCounter: GameCounter,
		GameSession: GameSession,
		HighestScore: HighestScore,
		PlayerState: PlayerState,
		PlayerStats: PlayerStats,
		TileOccupant: TileOccupant,
		Vec2: Vec2,
		CombatResult: CombatResult,
		EncounterOccurred: EncounterOccurred,
		HighestScoreUpdated: HighestScoreUpdated,
		Moved: Moved,
		NeighborsRevealed: NeighborsRevealed,
		PlayerDied: PlayerDied,
		Spawned: Spawned,
		GameContext: GameContext,
		GameContextDetails: GameContextDetails,
		GameDetail: GameDetail,
		MintGameParams: MintGameParams,
		GameState: GameState,
	},
}
export const schema: SchemaType = {
	hexed: {
		GameCounter: {
			token_id: 0,
			active_games: 0,
		},
		GameSession: {
			token_id: 0,
			player: "",
			is_active: false,
		},
		HighestScore: {
			token_id: 0,
			player: "",
			username: 0,
			xp: 0,
		},
		PlayerState: {
			token_id: 0,
		position: { x: 0, y: 0, },
			last_direction: new CairoOption(CairoOptionVariant.None),
			can_move: false,
		},
		PlayerStats: {
			token_id: 0,
			hp: 0,
			max_hp: 0,
			xp: 0,
		},
		TileOccupant: {
			x: 0,
			y: 0,
			token_id: 0,
		},
		Vec2: {
			x: 0,
			y: 0,
		},
		CombatResult: {
			attacker_token_id: 0,
			defender_token_id: 0,
			attacker_won: false,
		attacker_position: { x: 0, y: 0, },
		defender_position: { x: 0, y: 0, },
			damage_dealt: 0,
			retaliation_damage: 0,
			xp_awarded: 0,
			hp_reward: 0,
			attacker_died: false,
			defender_died: false,
		},
		EncounterOccurred: {
			token_id: 0,
			is_gift: false,
			outcome: 0,
			hp_after: 0,
			max_hp_after: 0,
			xp_after: 0,
			player_died: false,
		},
		HighestScoreUpdated: {
			player: "",
			username: 0,
			xp: 0,
		},
		Moved: {
			token_id: 0,
		direction: new CairoCustomEnum({ 
					East: "",
				NorthEast: undefined,
				NorthWest: undefined,
				West: undefined,
				SouthWest: undefined,
				SouthEast: undefined, }),
		position: { x: 0, y: 0, },
		},
		NeighborsRevealed: {
			token_id: 0,
		position: { x: 0, y: 0, },
			neighbors: 0,
		},
		PlayerDied: {
			token_id: 0,
			killed_by: 0,
		position: { x: 0, y: 0, },
		},
		Spawned: {
			token_id: 0,
			player: "",
		position: { x: 0, y: 0, },
		},
		GameContext: {
			name: 0,
			value: 0,
		},
		GameContextDetails: {
		name: "",
		description: "",
			id: new CairoOption(CairoOptionVariant.None),
			context: [{ name: 0, value: 0, }],
		},
		GameDetail: {
			name: 0,
			value: 0,
		},
		MintGameParams: {
			player_name: new CairoOption(CairoOptionVariant.None),
			settings_id: new CairoOption(CairoOptionVariant.None),
			start: new CairoOption(CairoOptionVariant.None),
			end: new CairoOption(CairoOptionVariant.None),
			objective_id: new CairoOption(CairoOptionVariant.None),
			context: new CairoOption(CairoOptionVariant.None),
			client_url: new CairoOption(CairoOptionVariant.None),
			renderer_address: new CairoOption(CairoOptionVariant.None),
			skills_address: new CairoOption(CairoOptionVariant.None),
			to: "",
			soulbound: false,
			paymaster: false,
			salt: 0,
			metadata: 0,
		},
		GameState: {
			token_id: 0,
			player: "",
		position: { x: 0, y: 0, },
			last_direction: new CairoOption(CairoOptionVariant.None),
			can_move: false,
			is_active: false,
			hp: 0,
			max_hp: 0,
			xp: 0,
			neighbor_occupancy: 0,
		},
	},
};
export enum ModelsMapping {
	Direction = 'hexed-Direction',
	GameCounter = 'hexed-GameCounter',
	GameSession = 'hexed-GameSession',
	HighestScore = 'hexed-HighestScore',
	PlayerState = 'hexed-PlayerState',
	PlayerStats = 'hexed-PlayerStats',
	TileOccupant = 'hexed-TileOccupant',
	Vec2 = 'hexed-Vec2',
	CombatResult = 'hexed-CombatResult',
	EncounterOccurred = 'hexed-EncounterOccurred',
	HighestScoreUpdated = 'hexed-HighestScoreUpdated',
	Moved = 'hexed-Moved',
	NeighborsRevealed = 'hexed-NeighborsRevealed',
	PlayerDied = 'hexed-PlayerDied',
	Spawned = 'hexed-Spawned',
	GameContext = 'game_components_interfaces-GameContext',
	GameContextDetails = 'game_components_interfaces-GameContextDetails',
	GameDetail = 'game_components_interfaces-GameDetail',
	MintGameParams = 'game_components_interfaces-MintGameParams',
	GameState = 'hexed-GameState',
}