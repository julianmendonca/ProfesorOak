class User {
  constructor(id, username, pokemons) {
    this.id = id;
    this.username = username;
    this.pokemons = pokemons;
    this.pokemonEncounter;
  }
}

module.exports = User;
