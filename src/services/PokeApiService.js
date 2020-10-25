const Pokemon = require("../entities/Pokemon.js");
const fetch = require("node-fetch");

class PokeApi {
  constructor() {}

  randomNumber = (max, min = 0) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  getSpanishMove = async (move) => {
    const moveNames = await fetch("https://pokeapi.co/api/v2/move/" + move);
    const moveNamesJson = await moveNames.json();
    return moveNamesJson.names.find((lang) => lang.language.name == "es").name;
  };

  getPokemonData = async (pokemonName) => {
    return await fetch(
      "https://pokeapi.co/api/v2/pokemon/" + pokemonName
    ).then((res) => res.json());
  };

  getPokemonStory = async (pokemonName) => {
    const pokemonData = await fetch(
      "https://pokeapi.co/api/v2/pokemon-species/" + pokemonName
    ).then((res) => res.json());
    return pokemonData.flavor_text_entries.find((i) => i.language.name == "es")
      .flavor_text;
  };

  getRandomPokemon = async (maxLvl, maxPokemonsAmount) => {
    const legendaryPokemons = [
      "mew",
      "mewtwo",
      "zapdos",
      "moltres",
      "articuno",
      "celebi",
      "ho-oh",
      "lugia",
      "suicune",
      "entei",
      "tyranitar",
      "deoxys",
      "jirachi",
      "rayquaza",
      "groundon",
      "kyogre",
      "latios",
      "latias",
      "regirock",
      "regice",
      "registeel",
    ];
    let limitValue = 151;
    if (maxPokemonsAmount >= 145) {
      limitValue = 251;
    }
    if (maxPokemonsAmount >= 247) {
      limitValue = 386;
    }
    const firstGenPokemons = await fetch(
      "https://pokeapi.co/api/v2/pokemon?limit=" + limitValue
    ).then((res) => res.json());
    let randomNumber = this.randomNumber(firstGenPokemons.results.length);
    let pokemon = firstGenPokemons.results[randomNumber].name;
    if (legendaryPokemons.includes(pokemon.toLowerCase())) {
      randomNumber = this.randomNumber(firstGenPokemons.results.length);
      pokemon = firstGenPokemons.results[randomNumber].name;
    }
    const pokemonLvl = this.randomNumber(maxLvl + 5, 1);
    const pokemonData = await this.getPokemonData(pokemon);
    const hp = pokemonData.stats.find((stat) => stat.stat.name == "hp")
      .base_stat;
    const attack = pokemonData.stats.find((stat) => stat.stat.name == "attack")
      .base_stat;
    const moves = pokemonData.moves;
    const isShiny = this.randomNumber(1000) >= 998 ? true : false;
    const image = isShiny
      ? pokemonData.sprites.front_shiny
      : pokemonData.sprites.front_default;
    const returnPokemon = new Pokemon(
      pokemon,
      pokemonLvl,
      hp,
      attack,
      moves,
      image,
      isShiny
    );
    return returnPokemon;
  };
}

module.exports = PokeApi;
