#[dojo::contract]
pub mod game_token_systems {
    use game_components_embeddable_game_standard::minigame::interface::IMinigameTokenData;
    use game_components_embeddable_game_standard::minigame::minigame_component::MinigameComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use hexed::constants::constants::DEFAULT_NS;
    use hexed::models::{GameSession, PlayerStats};
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;

    component!(path: MinigameComponent, storage: minigame, event: MinigameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl MinigameImpl = MinigameComponent::MinigameImpl<ContractState>;
    impl MinigameInternalImpl = MinigameComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        minigame: MinigameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MinigameEvent: MinigameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    fn dojo_init(
        ref self: ContractState,
        creator_address: ContractAddress,
        token_address: ContractAddress,
    ) {
        self
            .minigame
            .initializer(
                creator_address,
                "Hexed",
                "Fully onchain async battle royale with fog of war on a hex grid",
                "FemiOje",
                "FemiOje",
                "Battle Royale",
                "",
                Option::None, // color
                Option::None, // client_url
                Option::None, // renderer_address
                Option::None, // settings_address
                Option::None, // objectives_address
                token_address,
                Option::None, // royalty_fraction
                Option::None, // skills_address
                0, // version
            );
    }

    /// IMinigameTokenData — reads directly from Dojo models keyed by token_id
    #[abi(embed_v0)]
    impl GameTokenDataImpl of IMinigameTokenData<ContractState> {
        fn score(self: @ContractState, token_id: felt252) -> u64 {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let stats: PlayerStats = world.read_model(token_id);
            stats.xp.into()
        }

        fn game_over(self: @ContractState, token_id: felt252) -> bool {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let session: GameSession = world.read_model(token_id);
            !session.is_active
        }

        fn score_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<u64> {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let mut results = array![];
            for token_id in token_ids {
                let stats: PlayerStats = world.read_model(*token_id);
                results.append(stats.xp.into());
            };
            results
        }

        fn game_over_batch(self: @ContractState, token_ids: Span<felt252>) -> Array<bool> {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let mut results = array![];
            for token_id in token_ids {
                let session: GameSession = world.read_model(*token_id);
                results.append(!session.is_active);
            };
            results
        }
    }
}
