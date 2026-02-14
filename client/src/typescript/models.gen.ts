import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { CairoCustomEnum, CairoOption, CairoOptionVariant, BigNumberish } from 'starknet';

// Type definition for `untitled::models::GameSession` struct
export interface GameSession {
	game_id: BigNumberish;
	player: string;
	is_active: boolean;
}

// Type definition for `untitled::models::PlayerState` struct
export interface PlayerState {
	game_id: BigNumberish;
	position: Vec2;
	last_direction: CairoOption<DirectionEnum>;
	can_move: boolean;
}

// Type definition for `untitled::models::PlayerStats` struct
export interface PlayerStats {
	game_id: BigNumberish;
	hp: BigNumberish;
	max_hp: BigNumberish;
	xp: BigNumberish;
}

// Type definition for `untitled::models::TileOccupant` struct
export interface TileOccupant {
	x: BigNumberish;
	y: BigNumberish;
	game_id: BigNumberish;
}

// Type definition for `untitled::models::Vec2` struct
export interface Vec2 {
	x: BigNumberish;
	y: BigNumberish;
}

// Type definition for `untitled::systems::actions::actions::CombatResult` struct
export interface CombatResult {
	attacker_game_id: BigNumberish;
	defender_game_id: BigNumberish;
	attacker_won: boolean;
	attacker_position: Vec2;
	defender_position: Vec2;
	damage_dealt: BigNumberish;
	xp_awarded: BigNumberish;
	loser_died: boolean;
}

// Type definition for `untitled::systems::actions::actions::Moved` struct
export interface Moved {
	game_id: BigNumberish;
	direction: DirectionEnum;
	position: Vec2;
}

// Type definition for `untitled::systems::actions::actions::PlayerDied` struct
export interface PlayerDied {
	game_id: BigNumberish;
	killed_by: BigNumberish;
	position: Vec2;
}

// Type definition for `untitled::systems::actions::actions::Spawned` struct
export interface Spawned {
	game_id: BigNumberish;
	player: string;
	position: Vec2;
}

// Type definition for `untitled::models::GameState` struct
export interface GameState {
	game_id: BigNumberish;
	player: string;
	position: Vec2;
	last_direction: CairoOption<DirectionEnum>;
	can_move: boolean;
	is_active: boolean;
	hp: BigNumberish;
	max_hp: BigNumberish;
	xp: BigNumberish;
}

// Type definition for `untitled::models::Direction` enum
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
	untitled: {
		GameSession: GameSession,
		PlayerState: PlayerState,
		PlayerStats: PlayerStats,
		TileOccupant: TileOccupant,
		Vec2: Vec2,
		CombatResult: CombatResult,
		Moved: Moved,
		PlayerDied: PlayerDied,
		Spawned: Spawned,
		GameState: GameState,
	},
}
export const schema: SchemaType = {
	untitled: {
		GameSession: {
			game_id: 0,
			player: "",
			is_active: false,
		},
		PlayerState: {
			game_id: 0,
		position: { x: 0, y: 0, },
			last_direction: new CairoOption(CairoOptionVariant.None),
			can_move: false,
		},
		PlayerStats: {
			game_id: 0,
			hp: 0,
			max_hp: 0,
			xp: 0,
		},
		TileOccupant: {
			x: 0,
			y: 0,
			game_id: 0,
		},
		Vec2: {
			x: 0,
			y: 0,
		},
		CombatResult: {
			attacker_game_id: 0,
			defender_game_id: 0,
			attacker_won: false,
		attacker_position: { x: 0, y: 0, },
		defender_position: { x: 0, y: 0, },
			damage_dealt: 0,
			xp_awarded: 0,
			loser_died: false,
		},
		Moved: {
			game_id: 0,
		direction: new CairoCustomEnum({ 
					East: "",
				NorthEast: undefined,
				NorthWest: undefined,
				West: undefined,
				SouthWest: undefined,
				SouthEast: undefined, }),
		position: { x: 0, y: 0, },
		},
		PlayerDied: {
			game_id: 0,
			killed_by: 0,
		position: { x: 0, y: 0, },
		},
		Spawned: {
			game_id: 0,
			player: "",
		position: { x: 0, y: 0, },
		},
		GameState: {
			game_id: 0,
			player: "",
		position: { x: 0, y: 0, },
			last_direction: new CairoOption(CairoOptionVariant.None),
			can_move: false,
			is_active: false,
			hp: 0,
			max_hp: 0,
			xp: 0,
		},
	},
};
export enum ModelsMapping {
	Direction = 'untitled-Direction',
	GameSession = 'untitled-GameSession',
	PlayerState = 'untitled-PlayerState',
	PlayerStats = 'untitled-PlayerStats',
	TileOccupant = 'untitled-TileOccupant',
	Vec2 = 'untitled-Vec2',
	CombatResult = 'untitled-CombatResult',
	Moved = 'untitled-Moved',
	PlayerDied = 'untitled-PlayerDied',
	Spawned = 'untitled-Spawned',
	GameState = 'untitled-GameState',
}