import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoCustomEnum } from "starknet";

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
			return await provider.call("untitled", build_game_systems_getGameState_calldata(gameId));
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
				snAccount as any,
				build_game_systems_move_calldata(gameId, direction),
				"untitled",
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
				snAccount as any,
				build_game_systems_spawn_calldata(),
				"untitled",
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
			move: game_systems_move,
			buildMoveCalldata: build_game_systems_move_calldata,
			spawn: game_systems_spawn,
			buildSpawnCalldata: build_game_systems_spawn_calldata,
		},
	};
}