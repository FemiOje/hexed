#[dojo::contract]
pub mod renderer_systems {
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use game_components_embeddable_game_standard::minigame::interface::{
        IMinigameDetails, IMinigameDispatcher, IMinigameDispatcherTrait,
    };
    use game_components_embeddable_game_standard::minigame::minigame::require_owned_token;
    use game_components_interfaces::structs::GameDetail;
    use hexed::constants::constants::DEFAULT_NS;
    use hexed::models::{GameSession, PlayerState, PlayerStats};

    #[abi(embed_v0)]
    impl GameDetailsImpl of IMinigameDetails<ContractState> {
        fn token_name(self: @ContractState, token_id: felt252) -> ByteArray {
            self.validate_token_ownership(token_id);
            "HEXED"
        }

        fn token_description(self: @ContractState, token_id: felt252) -> ByteArray {
            self.validate_token_ownership(token_id);
            "A survivor exploring the fog-of-war hex grid in Hex'd"
        }

        fn game_details(self: @ContractState, token_id: felt252) -> Span<GameDetail> {
            self.validate_token_ownership(token_id);
            self.build_details(token_id)
        }

        fn token_name_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<ByteArray> {
            let mut results: Array<ByteArray> = array![];
            for _ in token_ids {
                results.append("HEXED");
            }
            results
        }

        fn token_description_batch(
            self: @ContractState, token_ids: Span<felt252>,
        ) -> Array<ByteArray> {
            let mut results: Array<ByteArray> = array![];
            for _ in token_ids {
                results.append("A survivor exploring the fog-of-war hex grid in Hex'd");
            }
            results
        }

        fn game_details_batch(
            self: @ContractState, token_ids: Span<felt252>,
        ) -> Array<Span<GameDetail>> {
            let mut results: Array<Span<GameDetail>> = array![];
            for token_id in token_ids {
                results.append(self.build_details(*token_id));
            }
            results
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn validate_token_ownership(self: @ContractState, token_id: felt252) {
            let mut world: WorldStorage = self.world(@DEFAULT_NS());
            let (game_token_addr, _) = world.dns(@"game_token_systems").unwrap();
            let minigame = IMinigameDispatcher { contract_address: game_token_addr };
            let token_address = minigame.token_address();
            require_owned_token(token_address, token_id);
        }

        fn build_details(self: @ContractState, token_id: felt252) -> Span<GameDetail> {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let stats: PlayerStats = world.read_model(token_id);
            let state: PlayerState = world.read_model(token_id);
            let session: GameSession = world.read_model(token_id);

            let status = if session.is_active {
                'Alive'
            } else if stats.hp == 0 {
                'Dead'
            } else {
                'Inactive'
            };

            array![
                GameDetail { name: 'HP', value: stats.hp.into() },
                GameDetail { name: 'Max HP', value: stats.max_hp.into() },
                GameDetail { name: 'XP', value: stats.xp.into() },
                GameDetail { name: 'Position X', value: state.position.x.into() },
                GameDetail { name: 'Position Y', value: state.position.y.into() },
                GameDetail { name: 'Status', value: status },
            ]
                .span()
        }
    }
}
