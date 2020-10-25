// base de datos
const UserPokemon = require("../entities/UserPokemon");
const PokeApiService = require("../services/PokeApiService.js");
const User = require("../entities/User.js");
const { Pool, Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const client = new Client();

class PersistenceService {
  constructor() {
    const { Client } = require("pg");
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    this.client.connect().catch((e) => console.log(e));
  }

  getCurrentEncounter = async (userId, serverId) => {
    const result = await this.client.query(
      `SELECT encounter FROM users WHERE user_id = '${userId}' and server_id = '${serverId}'`
    );
    const currentEncounter = JSON.parse(result.rows[0].encounter);
    if (currentEncounter.name == undefined) return undefined;
    const encounter = new UserPokemon(
      currentEncounter.name,
      currentEncounter.lvl,
      currentEncounter.shiny,
      currentEncounter.image
    );
    return encounter;
  };

  setEncounterPokemon = async (userId, serverId, pokemon) => {
    await this.client.query(
      `UPDATE users SET encounter = '${JSON.stringify(
        pokemon
      )}' WHERE user_id = '${userId}' and server_id='${serverId}'`
    );
  };

  getUser = async (userId) => {
    const result = await this.client.query(
      `SELECT * FROM users WHERE user_id = '${userId}' and server_id = '${serverId}'`
    );
    if (result.rows.length == 0) return undefined;
    const userObject = {
      id: result.rows[0].user_id,
      pokemons: result.rows[0].pokemones,
      pokemonEncounter: resule.rows[0].encounter,
    };
    return userObject;
  };

  getMaxLvl = async (userId, serverId) => {
    const result = await this.client.query(
      `select MAX(lvl) from pokemons where server_id = '${serverId}' and user_id = '${userId}'`
    );
    const maxLvlPokemon = result.rows[0].max;
    return maxLvlPokemon;
  };

  getSpecificUserPokemon = async (userId, serverId, pokemonName) => {
    const result = await this.client.query(
      `SELECT * FROM pokemons WHERE user_id = '${userId}' and server_id = '${serverId}' and name = '${pokemonName}'`
    );
    const pokemon = result.rows[0];
    if (pokemon == undefined) return undefined;
    return pokemon;
  };

  getAllUserPokemons = async (userId, serverId) => {
    const result = await this.client.query(
      `SELECT * FROM pokemons WHERE user_id = '${userId}' and server_id = '${serverId}'`
    );
    if (result.rows.length == 0) return undefined;
    const unsortedPokemons = result.rows;
    const sortedPokemons = unsortedPokemons.sort(
      (a, b) => parseFloat(b.lvl) - parseFloat(a.lvl)
    );
    return sortedPokemons;
  };

  addXp = async (userId, serverId, chosenPokemon, amountXp) => {
    const result = await this.client.query(
      `SELECT * FROM pokemons WHERE user_id = '${userId}' and server_id = '${serverId}' and name = '${chosenPokemon}'`
    );
    let pokemon = result.rows[0];
    if (pokemon == undefined) return null;
    pokemon.xp = parseInt(pokemon.xp);
    const currXp = pokemon.xp;
    // Si la xp es igual o mayor al lv aumenta 1 nivel
    let pokemonLvlUp = {};
    if (currXp + amountXp >= pokemon.lvl * 4) {
      pokemon.lvl++;
      pokemon.xp = 0;
      pokemonLvlUp = { lvlUp: true, pokemonLvl: pokemon.lvl };
    } else {
      pokemon.xp += Math.round(amountXp);
      pokemonLvlUp = { lvlUp: false, pokemonLvl: pokemon.lvl };
    }
    await this.client.query(
      `UPDATE pokemons SET lvl = ${pokemon.lvl}, xp = ${pokemon.xp} where user_id = '${userId}' and server_id = '${serverId}' and name = '${chosenPokemon}'`
    );
    return pokemonLvlUp;
  };
  setShiny = async (userId, serverId, pokemonName, shiny) => {
    const PokeApi = new PokeApiService();
    const pokemonData = await PokeApi.getPokemonData(pokemonName);
    const image = shiny
      ? pokemonData.sprites.front_shiny
      : pokemonData.sprites.front_default;

    await this.client.query(
      `update pokemons set shiny = ${shiny}, image = '${image}' where user_id = '${userId}' and server_id = '${serverId}' and name = '${pokemonName}'`
    );
  };
  addPokemon = async (userId, serverId, pokemon) => {
    const result = await this.client.query(
      `SELECT * FROM pokemons WHERE user_id = '${userId}' and server_id = '${serverId}' and name = '${pokemon.name}'`
    );
    // Get your user
    let dbPokemon = result.rows[0];
    if (
      dbPokemon != undefined &&
      dbPokemon.name == pokemon.name &&
      pokemon.lvl > dbPokemon.lvl
    ) {
      // Seteo el lvl del capturado y seteo xp = 0
      dbPokemon.lvl = pokemon.lvl;
      dbPokemon.xp = 0;
      await this.client.query(
        `UPDATE pokemons SET lvl = '${pokemon.lvl}', xp = ${dbPokemon.xp} WHERE user_id = '${userId}' and server_id='${serverId}' and name = '${dbPokemon.name}'`
      );
      return [false, dbPokemon];
    } else if (
      dbPokemon != undefined &&
      dbPokemon.name == pokemon.name &&
      pokemon.lvl <= dbPokemon.lvl
    )
      return [null, dbPokemon];
    await this.client.query(
      `INSERT INTO pokemons VALUES ('${userId}', '${serverId}', '${pokemon.name}','${pokemon.lvl}','${pokemon.shiny}','${pokemon.image}','${pokemon.xp}','${pokemon.timeCatched}')`
    );
    return [true, pokemon];
  };
  transferPokemon = async (fromId, toId, serverId, pokemonName) => {
    const pokemonesFrom = await this.getAllUserPokemons(fromId, serverId);
    let pokemonesTo = await this.getAllUserPokemons(toId, serverId);
    if (pokemonesTo == undefined) {
      await this.setNewUser(toId, serverId);
    }
    const pokemonRegalado = pokemonesFrom.find((i) => i.name == pokemonName);
    await this.client.query(
      `DELETE FROM pokemons WHERE user_id = '${toId}' and server_id = '${serverId}' and name = '${pokemonName}';`
    );
    await this.client.query(
      `DELETE FROM pokemons WHERE user_id = '${fromId}' and server_id = '${serverId}' and name = '${pokemonName}';`
    );
    await this.client.query(
      `INSERT INTO pokemons VALUES ('${toId}', '${serverId}', '${pokemonRegalado.name}','${pokemonRegalado.lvl}','${pokemonRegalado.shiny}','${pokemonRegalado.image}','${pokemonRegalado.xp}','${pokemonRegalado.timeCatched}')`
    );
  };
  setNewUser = async (userId, serverId) => {
    const put = await this.client.query(
      `INSERT INTO users VALUES ('${userId}', '${serverId}', '[]','{}')`
    );
    return true;
  };
  getMaxAmountOfPokemons = async (server_id) => {
    function getMax(arr, prop) {
      var max;
      for (var i = 0; i < arr.length; i++) {
        if (max == null || parseInt(arr[i][prop]) > parseInt(max[prop]))
          max = arr[i];
      }
      return max;
    }
    const response = await this.client.query(
      `
      SELECT user_id, count(distinct name) AS max
      FROM pokemons where server_id = '${server_id}'
      GROUP BY user_id`
    );
    const allUsers = response.rows;
    const maxNumber = getMax(allUsers, "max");
    return maxNumber.max;
  };
}

module.exports = PersistenceService;
