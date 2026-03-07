import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoOption, CairoCustomEnum } from "starknet";
import { MintGameParams, GameContextDetails } from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_game_systems_getGameState_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "get_game_state",
			calldata: [tokenId],
		};
	};

	const game_systems_getGameState = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_systems_getGameState_calldata(tokenId));
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

	const build_game_systems_move_calldata = (tokenId: BigNumberish, direction: CairoCustomEnum): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "move",
			calldata: [tokenId, direction],
		};
	};

	const game_systems_move = async (snAccount: Account | AccountInterface, tokenId: BigNumberish, direction: CairoCustomEnum) => {
		try {
			return await provider.execute(
				snAccount as any,
				build_game_systems_move_calldata(tokenId, direction),
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
				snAccount as any,
				build_game_systems_registerScore_calldata(player, username, xp),
				"hexed",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_systems_spawn_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "game_systems",
			entrypoint: "spawn",
			calldata: [tokenId],
		};
	};

	const game_systems_spawn = async (snAccount: Account | AccountInterface, tokenId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount as any,
				build_game_systems_spawn_calldata(tokenId),
				"hexed",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_gameOver_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "game_over",
			calldata: [tokenId],
		};
	};

	const game_token_systems_gameOver = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_token_systems_gameOver_calldata(tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_gameOverBatch_calldata = (tokenIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "game_over_batch",
			calldata: [tokenIds],
		};
	};

	const game_token_systems_gameOverBatch = async (tokenIds: Array<BigNumberish>) => {
		try {
			return await provider.call("hexed", build_game_token_systems_gameOverBatch_calldata(tokenIds));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_mintGame_calldata = (playerName: CairoOption<BigNumberish>, settingsId: CairoOption<BigNumberish>, start: CairoOption<BigNumberish>, end: CairoOption<BigNumberish>, objectiveId: CairoOption<BigNumberish>, context: CairoOption<GameContextDetails>, clientUrl: CairoOption<string>, rendererAddress: CairoOption<string>, skillsAddress: CairoOption<string>, to: string, soulbound: boolean, paymaster: boolean, salt: BigNumberish, metadata: BigNumberish): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "mint_game",
			calldata: [playerName, settingsId, start, end, objectiveId, context, clientUrl, rendererAddress, skillsAddress, to, soulbound, paymaster, salt, metadata],
		};
	};

	const game_token_systems_mintGame = async (playerName: CairoOption<BigNumberish>, settingsId: CairoOption<BigNumberish>, start: CairoOption<BigNumberish>, end: CairoOption<BigNumberish>, objectiveId: CairoOption<BigNumberish>, context: CairoOption<GameContextDetails>, clientUrl: CairoOption<string>, rendererAddress: CairoOption<string>, skillsAddress: CairoOption<string>, to: string, soulbound: boolean, paymaster: boolean, salt: BigNumberish, metadata: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_token_systems_mintGame_calldata(playerName, settingsId, start, end, objectiveId, context, clientUrl, rendererAddress, skillsAddress, to, soulbound, paymaster, salt, metadata));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_mintGameBatch_calldata = (mints: Array<MintGameParams>): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "mint_game_batch",
			calldata: [mints],
		};
	};

	const game_token_systems_mintGameBatch = async (mints: Array<MintGameParams>) => {
		try {
			return await provider.call("hexed", build_game_token_systems_mintGameBatch_calldata(mints));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_objectivesAddress_calldata = (): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "objectives_address",
			calldata: [],
		};
	};

	const game_token_systems_objectivesAddress = async () => {
		try {
			return await provider.call("hexed", build_game_token_systems_objectivesAddress_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_score_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "score",
			calldata: [tokenId],
		};
	};

	const game_token_systems_score = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_token_systems_score_calldata(tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_scoreBatch_calldata = (tokenIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "score_batch",
			calldata: [tokenIds],
		};
	};

	const game_token_systems_scoreBatch = async (tokenIds: Array<BigNumberish>) => {
		try {
			return await provider.call("hexed", build_game_token_systems_scoreBatch_calldata(tokenIds));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_settingsAddress_calldata = (): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "settings_address",
			calldata: [],
		};
	};

	const game_token_systems_settingsAddress = async () => {
		try {
			return await provider.call("hexed", build_game_token_systems_settingsAddress_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_supportsInterface_calldata = (interfaceId: BigNumberish): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "supports_interface",
			calldata: [interfaceId],
		};
	};

	const game_token_systems_supportsInterface = async (interfaceId: BigNumberish) => {
		try {
			return await provider.call("hexed", build_game_token_systems_supportsInterface_calldata(interfaceId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_token_systems_tokenAddress_calldata = (): DojoCall => {
		return {
			contractName: "game_token_systems",
			entrypoint: "token_address",
			calldata: [],
		};
	};

	const game_token_systems_tokenAddress = async () => {
		try {
			return await provider.call("hexed", build_game_token_systems_tokenAddress_calldata());
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
		game_token_systems: {
			gameOver: game_token_systems_gameOver,
			buildGameOverCalldata: build_game_token_systems_gameOver_calldata,
			gameOverBatch: game_token_systems_gameOverBatch,
			buildGameOverBatchCalldata: build_game_token_systems_gameOverBatch_calldata,
			mintGame: game_token_systems_mintGame,
			buildMintGameCalldata: build_game_token_systems_mintGame_calldata,
			mintGameBatch: game_token_systems_mintGameBatch,
			buildMintGameBatchCalldata: build_game_token_systems_mintGameBatch_calldata,
			objectivesAddress: game_token_systems_objectivesAddress,
			buildObjectivesAddressCalldata: build_game_token_systems_objectivesAddress_calldata,
			score: game_token_systems_score,
			buildScoreCalldata: build_game_token_systems_score_calldata,
			scoreBatch: game_token_systems_scoreBatch,
			buildScoreBatchCalldata: build_game_token_systems_scoreBatch_calldata,
			settingsAddress: game_token_systems_settingsAddress,
			buildSettingsAddressCalldata: build_game_token_systems_settingsAddress_calldata,
			supportsInterface: game_token_systems_supportsInterface,
			buildSupportsInterfaceCalldata: build_game_token_systems_supportsInterface_calldata,
			tokenAddress: game_token_systems_tokenAddress,
			buildTokenAddressCalldata: build_game_token_systems_tokenAddress_calldata,
		},
	};
}