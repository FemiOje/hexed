import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { CairoCustomEnum, CairoOption, CairoOptionVariant, BigNumberish } from 'starknet';

// Type definition for `dojo_starter::models::DirectionsAvailable` struct
export interface DirectionsAvailable {
	player: string;
	directions: Array<DirectionEnum>;
}

// Type definition for `dojo_starter::models::Moves` struct
export interface Moves {
	player: string;
	remaining: BigNumberish;
	last_direction: CairoOption<DirectionEnum>;
	can_move: boolean;
}

// Type definition for `dojo_starter::models::Position` struct
export interface Position {
	player: string;
	vec: Vec2;
}

// Type definition for `dojo_starter::models::PositionCount` struct
export interface PositionCount {
	identity: string;
	position: Array<[BigNumberish, BigNumberish]>;
}

// Type definition for `dojo_starter::models::Vec2` struct
export interface Vec2 {
	x: BigNumberish;
	y: BigNumberish;
}

// Type definition for `dojo_starter::systems::actions::actions::Moved` struct
export interface Moved {
	player: string;
	direction: DirectionEnum;
}

// Type definition for `dojo_starter::models::Direction` enum
export const direction = [
	'Left',
	'Right',
	'Up',
	'Down',
] as const;
export type Direction = { [key in typeof direction[number]]: string };
export type DirectionEnum = CairoCustomEnum;

export interface SchemaType extends ISchemaType {
	dojo_starter: {
		DirectionsAvailable: DirectionsAvailable,
		Moves: Moves,
		Position: Position,
		PositionCount: PositionCount,
		Vec2: Vec2,
		Moved: Moved,
	},
}
export const schema: SchemaType = {
	dojo_starter: {
		DirectionsAvailable: {
			player: "",
			directions: [new CairoCustomEnum({ 
					Left: "",
				Right: undefined,
				Up: undefined,
				Down: undefined, })],
		},
		Moves: {
			player: "",
			remaining: 0,
			last_direction: new CairoOption(CairoOptionVariant.None),
			can_move: false,
		},
		Position: {
			player: "",
		vec: { x: 0, y: 0, },
		},
		PositionCount: {
			identity: "",
			position: [[0, 0]],
		},
		Vec2: {
			x: 0,
			y: 0,
		},
		Moved: {
			player: "",
		direction: new CairoCustomEnum({ 
					Left: "",
				Right: undefined,
				Up: undefined,
				Down: undefined, }),
		},
	},
};
export enum ModelsMapping {
	Direction = 'dojo_starter-Direction',
	DirectionsAvailable = 'dojo_starter-DirectionsAvailable',
	Moves = 'dojo_starter-Moves',
	Position = 'dojo_starter-Position',
	PositionCount = 'dojo_starter-PositionCount',
	Vec2 = 'dojo_starter-Vec2',
	Moved = 'dojo_starter-Moved',
}