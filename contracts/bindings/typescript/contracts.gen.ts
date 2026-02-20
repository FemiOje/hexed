import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoOption, CairoCustomEnum } from "starknet";
import * as models from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_game_systems_getGameState_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "get_game_state",
			calldata: [gameId],
		};
	};

	const game_systems_getGameState = async (gameId: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_systems_getGameState_calldata(gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_systems_getHighestScore_calldata = (): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "get_highest_score",
			calldata: [],
		};
	};

	const game_systems_getHighestScore = async () => {
		try {
			return await provider.call("hexed", build_game_systems_getHighestScore_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_systems_move_calldata = (gameId: BigNumberish, direction: CairoCustomEnum): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "move",
			calldata: [gameId, direction],
		};
	};

	const game_systems_move = async (snAccount: Account | AccountInterface, gameId: BigNumberish, direction: CairoCustomEnum) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_systems_move_calldata(gameId, direction),
				"hexed",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_systems_registerScore_calldata = (player: string, username: BigNumberish, xp: BigNumberish): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "register_score",
			calldata: [player, username, xp],
		};
	};

	const game_systems_registerScore = async (snAccount: Account | AccountInterface, player: string, username: BigNumberish, xp: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_systems_registerScore_calldata(player, username, xp),
				"hexed",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_systems_spawn_calldata = (): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "spawn",
			calldata: [],
		};
	};

	const game_systems_spawn = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_systems_spawn_calldata(),
				"hexed",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};



	return {
		game_systems: {
			getGameState: game_systems_getGameState,
			buildGetGameStateCalldata: build_game_systems_getGameState_calldata,
			getHighestScore: game_systems_getHighestScore,
			buildGetHighestScoreCalldata: build_game_systems_getHighestScore_calldata,
			move: game_systems_move,
			buildMoveCalldata: build_game_systems_move_calldata,
			registerScore: game_systems_registerScore,
			buildRegisterScoreCalldata: build_game_systems_registerScore_calldata,
			spawn: game_systems_spawn,
			buildSpawnCalldata: build_game_systems_spawn_calldata,
		},
	};
}