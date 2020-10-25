const Discord = require("discord.js");
const { Client, MessageEmbed } = require("discord.js");
const Canvas = require("canvas");
const dotenv = require("dotenv");
dotenv.config();
const Pokemon = require("../entities/Pokemon.js");
const UserPokemon = require("../entities/UserPokemon.js");
const PersistanceService = require("../services/PersistenceService.js");
const PokeApiService = require("../services/PokeApiService.js");
const PokeApi = new PokeApiService();
const usersDb = new PersistanceService();
const client = new Client();

let amountOfMessages = 0;
const amountMessagesNeeded = 15;
const pokemonChannelName = "mundo-pokemon";
let pokemonesPorCeder = [];
let shinyChange = [];
let regalosPendientes = [];
let desafiosPendientes = [];
let apuestasPendientes = [];

client.on("message", function (message) {
  //if (message.author.bot) return;
  if (
    message.author.id == 750395100223504415 ||
    message.author.id == "750395100223504415"
  )
    return;
  if (
    message.content[0] != process.env.COMMAND_CHAR &&
    message.content[0] != "-"
  )
    amountOfMessages++;
  const command = getCommand(message.content);
  if (amountOfMessages >= amountMessagesNeeded) wildPokemonAppear(message);
  if (message.content[0] != process.env.COMMAND_CHAR) return;
  if (message.channel.name != pokemonChannelName)
    return message.reply(
      ' Los comandos de pokemon solo funcionan en el canal de texto "mundo-pokemon"'
    );
  if (command == "start") setInitalPokemon(message);
  if (command == "pokemones") getAllUserPokemons(message);
  if (command == "pendiente") showCurrentEncounter(message);
  if (command == "ceder") cederCurrentEncounter(message);
  if (command == "comandos") showCommands(message);
  if (command == "aceptar") aceptarCedido(message);
  if (command == "rechazar") rechazarCedido(message);
  if (command == "enviar") fightEncounter(message);
  if (command == "pokedex") showSpecificPokemonStats(message);
  if (command == "shinyfy") shinyfy(message);
  if (command == "buscar") buscarRandom(message);
  if (command == "regalar") regalarPokemon(message);
  if (command == "recibir") recibirPokemon(message);
  if (command == "desafiar") desafiarUsuario(message);
  if (command == "apostar") generarApuesta(message);
});

// Genera una apuesta, agregando el pokemon ganado a la db
const generarApuesta = async (message) => {
  const params = getParams(message.content);
  if (params.length != 2)
    return message.reply(
      " Debes elegir con quien pelear y que pokemon enviar. Ej: '!apostar @usuario charmander'"
    );
  const oponentId = params[0].includes("<@")
    ? params[0].replace("<@!", "").replace("<@", "").replace(">", "")
    : params[1].replace("<@!", "").replace("<@", "").replace(">", "");
  const chosenPokemonName = params[0].includes("<@") ? params[1] : params[0];
  const allPokemons = await usersDb.getAllUserPokemons(
    message.author.id,
    message.guild.id
  );
  if (allPokemons.length <= 1)
    return message.reply(" Debes tener al menos 2 pokemones para apostar");
  const chosenPokemon = allPokemons.find((i) => i.name == chosenPokemonName);
  if (chosenPokemon == undefined)
    return message.reply(` No tienes a ${chosenPokemonName}`);
  // Me fijo si ya tiene una apuesta pendiente, si la tiene hago la pelea y sino la seteo en la apuestasPendientes
  const apuestaPendiente = apuestasPendientes.find(
    (i) => i.from == oponentId && i.to == message.author.id
  );
  if (apuestaPendiente == undefined) {
    let newApuestasPendientes = [];
    apuestasPendientes.forEach((desafio) => {
      if (desafio.to != message.author.id && desafio.from != message.author.id)
        newApuestasPendientes.push(desafio);
    });
    newApuestasPendientes.push({
      from: message.author.id,
      to: oponentId,
      pokemonName: chosenPokemonName,
    });
    apuestasPendientes = newApuestasPendientes;
    return message.reply(
      ` Apostaste tu ${chosenPokemonName}, ahora <@${oponentId}> debe '!apostar <@${message.author.id}> pokemon'`
    );
  } else {
    const pokemonOponente = await usersDb.getSpecificUserPokemon(
      apuestaPendiente.from,
      message.guild.id,
      apuestaPendiente.pokemonName
    );
    const pokemonElegido = chosenPokemon;
    const fightResult = await generatePokemonFight(
      pokemonElegido,
      pokemonOponente,
      message.channel
    );
    const winnerId =
      fightResult.winner == "atacante"
        ? message.author.id
        : apuestaPendiente.from;
    const loserId =
      fightResult.winner == "atacante"
        ? apuestaPendiente.from
        : message.author.id;
    const pokemonGanado =
      fightResult.winner == "atacante"
        ? apuestaPendiente.pokemonName
        : fightResult.pokemon.name;
    await usersDb.transferPokemon(
      loserId,
      winnerId,
      message.guild.id,
      pokemonGanado
    );
    const embed = new MessageEmbed()
      .setTitle(fightResult.pokemon.name.toUpperCase() + " ganó")
      .setDescription(
        ` el **${fightResult.pokemon.name}** de <@${winnerId}> ganó la batalla ahora el ***${apuestaPendiente.pokemonName}*** de <@${loserId}> es suyo`
      )
      .setColor("RED")
      .setImage(fightResult.pokemon.image)
      .setFooter("Lvl " + fightResult.pokemon.lvl);
    message.channel.send(embed);
    const resultObject = {
      winnerId: winnerId,
      loserId: loserId,
      pokemonName: pokemonGanado,
    };
    let newApuestasPendientes = [];
    apuestasPendientes.forEach((desafio) => {
      if (desafio.to != message.author.id && desafio.from != message.author.id)
        newApuestasPendientes.push(desafio);
    });
    apuestasPendientes = newApuestasPendientes;
    return resultObject;
  }
};

// Crea un desafio tomando el usuario al que peleara y el pokemon que usara
const desafiarUsuario = async (message) => {
  const params = getParams(message.content);
  if (params.length != 2)
    return message.reply(
      " Debes elegir con quien pelear y que pokemon enviar. Ej: '!desafiar @usuario charmander'"
    );
  const oponentId = params[0].includes("<@")
    ? params[0].replace("<@!", "").replace("<@", "").replace(">", "")
    : params[1].replace("<@!", "").replace("<@", "").replace(">", "");
  const chosenPokemonName = params[0].includes("<@") ? params[1] : params[0];
  const chosenPokemon = await usersDb.getSpecificUserPokemon(
    message.author.id,
    message.guild.id,
    chosenPokemonName
  );
  if (chosenPokemon == undefined)
    return message.reply(` No tienes a ${chosenPokemonName}`);
  // Me fijo si ya tiene una pelea pendiente, si la tiene hago la pelea y sino la seteo en la desafiosPendientes
  const desafioPendiente = desafiosPendientes.find(
    (i) => i.from == oponentId && i.to == message.author.id
  );
  if (desafioPendiente != undefined) {
    const pokemonOponente = await usersDb.getSpecificUserPokemon(
      desafioPendiente.from,
      message.guild.id,
      desafioPendiente.pokemonName
    );
    const pokemonElegido = chosenPokemon;
    const fightResult = await generatePokemonFight(
      pokemonElegido,
      pokemonOponente,
      message.channel
    );
    const winnerId =
      fightResult.winner == "atacante"
        ? message.author.id
        : desafioPendiente.from;
    const loserId =
      fightResult.winner == "atacante"
        ? desafioPendiente.from
        : message.author.id;
    const pokemonGanado = fightResult.pokemon.name;
    const embed = new MessageEmbed()
      .setTitle(fightResult.pokemon.name.toUpperCase() + " ganó")
      .setDescription(
        ` el **${fightResult.pokemon.name}** de <@${winnerId}> ganó la batalla y derrotó al ***${desafioPendiente.pokemonName}*** de <@${loserId}>`
      )
      .setColor("RED")
      .setImage(fightResult.pokemon.image)
      .setFooter("Lvl " + fightResult.pokemon.lvl);
    message.channel.send(embed);
    const resultObject = {
      winnerId: winnerId,
      loserId: loserId,
      pokemonName: pokemonGanado,
    };
    let newDesafiosPendientes = [];
    desafiosPendientes.forEach((desafio) => {
      if (desafio.to != message.author.id && desafio.from != message.author.id)
        newDesafiosPendientes.push(desafio);
    });
    desafiosPendientes = newDesafiosPendientes;
    return resultObject;
  }
  let newDesafiosPendientes = [];
  desafiosPendientes.forEach((desafio) => {
    if (desafio.from != message.author.id) newDesafiosPendientes.push(desafio);
  });
  newDesafiosPendientes.push({
    from: message.author.id,
    to: oponentId,
    pokemonName: chosenPokemonName,
  });
  desafiosPendientes = newDesafiosPendientes;
  message.reply(
    ` Desafiaste a <@${oponentId}> con tu ${chosenPokemonName}, ahora el debe '!desafiar <@${message.author.id}> pokemon'`
  );
};
// Recibe el pokemon regalado en regalosPendientes
const recibirPokemon = async (message) => {
  const params = getParams(message.content);
  if (params.length != 2)
    return message.reply(" Debes escribir '!recibir nombredepokemon @usuario'");
  const regaladoId = params[0].includes("<@")
    ? params[0].replace("<@!", "").replace("<@", "").replace(">", "")
    : params[1].replace("<@!", "").replace("<@", "").replace(">", "");
  const pokemonName = params[0].includes("<@") ? params[1] : params[0];
  if (regalosPendientes.length == 0)
    return message.reply(` <@${regaladoId}> no te regalo a ${pokemonName}`);
  const regaloPendiente = regalosPendientes.find(
    (i) => i.from == regaladoId && i.pokemonName == pokemonName
  );
  if (regaloPendiente == undefined)
    return message.reply(` <@${regaladoId}> no te regalo a ${pokemonName}`);
  await usersDb.transferPokemon(
    regaladoId,
    message.author.id,
    message.guild.id,
    pokemonName
  );
  let newregalosPendientes = [];
  regalosPendientes.forEach((i) => {
    if (i.from == regaladoId && i.pokemonName == pokemonName) {
    } else {
      newregalosPendientes.push(i);
    }
  });
  regalosPendientes = newregalosPendientes;
  message.reply(
    ` Ahora tiene el ${pokemonName} que te regalo <@${regaladoId}>`
  );
};
// Agrega en regalosPendientes los !regalar pendiente
const regalarPokemon = async (message) => {
  const params = getParams(message.content);
  if (params.length != 2)
    return message.reply(
      " Falta el usuario o el pokemon, escribe '!regalar pokemon @usuario'"
    );
  const regaladoId = params[0].includes("<@")
    ? params[0].replace("<@!", "").replace("<@", "").replace(">", "")
    : params[1].replace("<@!", "").replace("<@", "").replace(">", "");
  const pokemonName = params[0].includes("<@") ? params[1] : params[0];
  const allPokemons = await usersDb.getAllUserPokemons(
    message.author.id,
    message.guild.id
  );
  if (allPokemons.length <= 1)
    return message.reply(" Debes tener al menos 2 pokemones para regalar 1");
  const hasPokemon = await usersDb.getSpecificUserPokemon(
    message.author.id,
    message.guild.id,
    pokemonName
  );
  if (hasPokemon == undefined)
    return message.reply(` No tienes ningun ${pokemonName}`);
  if (
    regalosPendientes.find(
      (i) => i.from == message.author.id && i.pokemonName == pokemonName
    )
  ) {
    regalosPendientes.find(
      (i) => i.from == message.author.id && i.pokemonName == pokemonName
    ).to = regaladoId;
    return message.reply(
      ` Le regalaste tu ${pokemonName} a <@${regaladoId}>, ahora tiene que escribir '!recibir <@${message.author.id}> ${pokemonName}'`
    );
  }
  const newPokemonRegalado = {
    from: message.author.id,
    to: regaladoId,
    pokemonName: pokemonName,
  };
  regalosPendientes.push(newPokemonRegalado);
  return message.reply(
    ` Le regalaste tu ${pokemonName} a <@${regaladoId}>, ahora tiene que escribir '!recibir <@${message.author.id}> ${pokemonName}'`
  );
};

// Aparece pokemones escribiendo !buscar
const buscarRandom = (message) => {
  const number = randomNumber(4);
  if (number == 3) wildPokemonAppear(message);
};

// Setea un pokemon de un usuario a shiny o no shiny
const shinyfy = async (message) => {
  const pokemonToShinyfy = shinyChange.find(
    (i) => i.userId == message.author.id && i.serverId == message.guild.id
  );
  if (
    pokemonToShinyfy == null ||
    pokemonToShinyfy == undefined ||
    pokemonToShinyfy.length == 0
  )
    return message.reply(
      " No tienen ningun pokemon pendiente por cambiar su shiny"
    );
  await usersDb.setShiny(
    message.author.id,
    message.guild.id,
    pokemonToShinyfy.pokemon,
    pokemonToShinyfy.setShinyTo
  );
  let newShinyfyPendings = [];
  shinyChange.forEach((pending) => {
    if (
      pending.userId != message.author.id &&
      pending.serverId != message.guild.id
    ) {
      newShinyfyPendings.push(pending);
    }
  });
  shinyChange = newShinyfyPendings;
  return message.reply(
    ` Cambiaste tu ***${pokemonToShinyfy.pokemon}*** a ***${
      pokemonToShinyfy.setShinyTo ? "shiny" : "no shiny"
    }***`
  );
};
// Dibuja un canvas con los datos pokedex de un pokemon
const drawPokedexCanvas = async (
  lvl,
  xp,
  shiny,
  hp,
  attack,
  dato,
  imagen,
  timeCatched
) => {
  const canvas = Canvas.createCanvas(600, 250);
  const ctx = canvas.getContext("2d");
  // Dibujo el background
  const background = await Canvas.loadImage(
    "https://media.discordapp.net/attachments/755198384394207304/755443234540355744/Fondopokedex.png"
  );
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  // Dibujo la imagen del pokemon
  const pokemonImage = await Canvas.loadImage(imagen);
  ctx.drawImage(pokemonImage, -10, 0, 150, canvas.height);

  //Agrego el texto de los datos
  ctx.font = "600 15px sans-serif";
  ctx.fillText("Lvl: " + lvl, canvas.width / 4, 20);
  ctx.fillText("Xp: " + xp + "/" + lvl * 4, canvas.width / 2, 20);
  ctx.fillText(shiny ? "shiny: si" : "shiny: no", canvas.width / 1.33, 20);
  ctx.fillText("Hp: " + hp, canvas.width / 4, 45);
  ctx.fillText("Attack: " + attack, canvas.width / 2, 45);
  ctx.fillText("Capturado: " + timeCatched, canvas.width / 4, 70);
  ctx.fillText(dato, 150, 150);

  const attachment = new Discord.MessageAttachment(canvas.toBuffer(), imagen);
  return attachment;
};
// Obtiene el canal de mundo-pokemon
const getPokemonChannel = () => {
  return client.channels.cache.find(
    (channel) => channel.name === pokemonChannelName
  );
};
// Retorna la fecha y hora actual
const getDate = () => {
  var today = new Date();
  var date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  var time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  return date + " " + time;
};
// Muestra los stats de un pokemon
const showSpecificPokemonStats = async (message) => {
  const params = getParams(message.content);
  if (params.length == 0)
    message.reply(
      " Elegí el pokemon para ver los stats, por ejemplo !pokedex pikachu"
    );
  if (params.length > 1)
    message.reply(" Solo podes elegir un pokemon para ver los stats");
  const pokemon = params[0];
  const pokemonStats = await usersDb.getSpecificUserPokemon(
    message.author.id,
    message.guild.id,
    pokemon
  );
  if (pokemonStats == undefined || pokemonStats == null)
    return message.reply(" No tienes este pokemon");
  const apiData = await PokeApi.getPokemonData(pokemon);
  const hp = apiData.stats[0].base_stat * pokemonStats.lvl * 0.5;
  const attack = apiData.stats[1].base_stat * pokemonStats.lvl * 0.5;
  const pokemonStory = await PokeApi.getPokemonStory(pokemon);
  const cavasData = await drawPokedexCanvas(
    pokemonStats.lvl,
    pokemonStats.xp,
    pokemonStats.shiny,
    hp,
    attack,
    pokemonStory,
    pokemonStats.image,
    pokemonStats.timeCatched
  );

  message.channel.send("", cavasData);
};
// Realiza el combate entre el encounter y 1 pokemon, y lo agrega a los pokemons del usuario y suma xp
const fightEncounter = async (message) => {
  const params = getParams(message.content);
  // Valido si el parametro esta bien
  if (params.length == 0)
    return message.reply(
      " Para enfrentarte a este pokemon tenes que escribir !enviar + pokemon, por ejemplo: !enviar charmander"
    );
  if (params.length > 1) return message.reply(" Solo puedes elegir un pokemon");
  // Obtengo datos del pokemon enviado
  const chosenPokemonText = params[0];
  const chosenPokemon = await usersDb.getSpecificUserPokemon(
    message.author.id,
    message.guild.id,
    chosenPokemonText
  );
  // Valido que tenga el pokemon enviado y que tenga un pokemon para capturar
  if (chosenPokemon == undefined)
    return message.reply(" No tenes este pokemon");
  const encounterPokemon = await usersDb.getCurrentEncounter(
    message.author.id,
    message.guild.id
  );
  if (encounterPokemon == undefined)
    return message.reply(" No hay ningun pokemon en la zona");
  // Genero la pelea entre ambos pokemones
  const winner = await generatePokemonFight(
    chosenPokemon,
    encounterPokemon,
    message.channel
  );
  let addResult;
  if (winner.winner == "atacante") {
    // Si gana el atacante verifico si ya tiene este pokemon capturado
    const userHasCapturedPokemon = await usersDb.getSpecificUserPokemon(
      message.author.id,
      message.guild.id,
      encounterPokemon.name
    );
    // Si no tiene el pokemon capturado lo guarda y da 1xp al pokemon que pelo
    let lvlUpPokemon;
    const capturedPokemon = new UserPokemon(
      encounterPokemon.name,
      encounterPokemon.lvl,
      encounterPokemon.shiny,
      encounterPokemon.image,
      0,
      getDate()
    );
    // addedPOkemon = true cuando no lo tenia, null cuando lo tenia y es lvl mas bajo (el salvaje), false cuando lo tenia y es lvl mas alto (el salvaje)
    const addResponse = await usersDb.addPokemon(
      message.author.id,
      message.guild.id,
      capturedPokemon
    );
    addResult = addResponse[0];
    const addedPokemon = addResponse[1];
    if (
      (addResult == false || addResult == null) &&
      userHasCapturedPokemon != null &&
      userHasCapturedPokemon != undefined &&
      capturedPokemon.shiny != userHasCapturedPokemon.shiny
    ) {
      const newShinyChange = shinyChange.map(
        (i) => i.userId != message.author.id
      );
      newShinyChange.push({
        userId: message.author.id,
        serverId: message.guild.id,
        pokemon: capturedPokemon.name,
        setShinyTo: capturedPokemon.shiny,
      });
      shinyChange = newShinyChange;
      message.reply(
        ` Ya tienes este pokemon ${
          userHasCapturedPokemon.shiny ? "shiny" : "no shiny"
        } deseas ***!shinyfy*** para hacerlo ${
          userHasCapturedPokemon.shiny ? "no shiny" : "shiny"
        }`
      );
    }

    if (addResult == false) {
      const embed = new MessageEmbed()
        .setTitle(winner.pokemon.name.toUpperCase() + " ganó")
        .setDescription(
          ` **${winner.pokemon.name.toUpperCase()}** ganó la batalla, ya tenias un ${
            capturedPokemon.name
          } de lvl mas bajo, ahora es lvl ${encounterPokemon.lvl}`
        )
        .setColor("RED")
        .setImage(winner.pokemon.image)
        .setFooter("Lvl " + winner.pokemon.lvl);
      message.channel.send(embed);
    }

    const xpToAdd =
      Math.round(capturedPokemon.lvl) == 0
        ? 2
        : Math.round(capturedPokemon.lvl);
    lvlUpPokemon = await usersDb.addXp(
      message.author.id,
      message.guild.id,
      chosenPokemon.name,
      xpToAdd
    );

    if (lvlUpPokemon.lvlUp == true) {
      message.channel.send(
        `El **${chosenPokemon.name}** de <@${message.author.id}> aumentó a nivel ${lvlUpPokemon.pokemonLvl}`
      );
      winner.pokemon.lvl++;
    }
  }
  await usersDb.setEncounterPokemon(message.author.id, message.guild.id, {});
  const newPorCeder = pokemonesPorCeder.map((i) => i.from != message.author.id);
  pokemonesPorCeder = newPorCeder;
  if (addResult != false) {
    const embed = new MessageEmbed()
      .setTitle(winner.pokemon.name.toUpperCase() + " ganó")
      .setDescription(
        ` **${winner.pokemon.name.toUpperCase()}** ganó la batalla ${
          winner.winner == "atacante"
            ? " y capturó a **" + encounterPokemon.name + "**"
            : "y huyo sin problemas"
        }`
      )
      .setColor("RED")
      .setImage(winner.pokemon.image)
      .setFooter("Lvl " + winner.pokemon.lvl);
    message.channel.send(embed);
  }
};

// Genera una pelea entre 2 pokemones, retorna el texto de la pelea
const generatePokemonFight = async (atacante, atacado, channel) => {
  // Obtengo hp, attack y moves de pokeapi
  const atacanteApiData = await PokeApi.getPokemonData(atacante.name);
  const atacanteImage = atacante.shiny
    ? atacanteApiData.sprites.front_shiny
    : atacanteApiData.sprites.front_default;
  const atacadoApiData = await PokeApi.getPokemonData(atacado.name);
  // Creo los objetos
  const atacanteStats = new Pokemon(
    atacante.name,
    atacante.lvl,
    atacanteApiData.stats[0].base_stat,
    atacanteApiData.stats[1].base_stat,
    atacanteApiData.moves.filter(
      (move) => move.version_group_details[0].level_learned_at <= atacante.lvl
    ),
    atacanteImage,
    atacante.shiny,
    atacante.xp
  );
  const atacadoStats = new Pokemon(
    atacado.name,
    atacado.lvl,
    atacadoApiData.stats[0].base_stat,
    atacadoApiData.stats[1].base_stat,
    atacadoApiData.moves.filter(
      (move) => move.version_group_details[0].level_learned_at <= atacado.lvl
    ),
    atacado.image,
    null,
    null
  );
  // Seteo el hp y attack acorde al lvl
  atacanteStats.hp = atacanteStats.hp * atacanteStats.lvl * 0.5;
  atacanteStats.attack = atacanteStats.attack * atacanteStats.lvl * 0.5;
  atacadoStats.hp = atacadoStats.hp * atacadoStats.lvl * 0.5;
  atacadoStats.attack = atacadoStats.attack * atacadoStats.lvl * 0.5;
  // Genero el texto y ganador de la pelea
  let fightText = "";
  let winner = false;
  let winnerPokemon;
  const startsNumber = randomNumber(10);
  let atacanteStarts = startsNumber > 5 ? true : false;
  while (winner == false) {
    // Obtengo el ataque del atacante
    if (atacanteStarts) {
      const atacanteMove = await PokeApi.getSpanishMove(
        atacanteStats.moves[randomNumber(atacanteStats.moves.length - 1)].move
          .name
      );
      // Obtengo el daño que va a hacer el atacante
      const atacanteDamage = Math.round(randomNumber(atacanteStats.attack));
      channel.send(
        `**${atacanteStats.name}** utilizó ***${atacanteMove}*** e hizo ***${atacanteDamage}*** de daño\n`
      );
      fightText += `**${atacanteStats.name}** utilizó ***${atacanteMove}*** e hizo ***${atacanteDamage}*** de daño\n`;
      atacadoStats.hp -= atacanteDamage;
      // Si muere el atacado rompo el loop y seteo los valores del winner
      if (atacadoStats.hp <= 0) {
        winnerPokemon = atacanteStats;
        winner = "atacante";
        break;
      }
    }
    atacanteStarts = true;
    // Otengo ataque del atacado
    const atacadoMove = await PokeApi.getSpanishMove(
      atacadoStats.moves[randomNumber(atacadoStats.moves.length - 1)].move.name
    );
    const atacadoDamage = Math.round(
      randomNumber(atacadoStats.attack) * Math.random()
    );

    channel.send(
      `**${atacadoStats.name}** utilizó ***${atacadoMove}*** e hizo ***${atacadoDamage}*** de daño\n`
    );
    fightText += `${atacadoStats.name} utilizó ${atacadoMove} e hizo ${atacadoDamage} de daño\n`;
    atacanteStats.hp -= atacadoDamage;
    if (atacanteStats.hp <= 0) {
      winnerPokemon = atacadoStats;
      winner = "atacado";
      break;
    }
  }
  return { winner: winner, pokemon: winnerPokemon };
};

// Genera un numero random
const randomNumber = (max, min = 0) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
// Rechaza un pokemon cedido
const rechazarCedido = (message) => {
  const encounterCedido = pokemonesPorCeder.find(
    (item) => item.to == message.author.id
  );
  message.reply(
    " Rechazaste el encuentro que te habia cedido <@" +
      encounterCedido.from +
      ">"
  );
  const porCeder = pokemonesPorCeder.map(
    (item) => item.to != message.author.id
  );
  pokemonesPorCeder = porCeder;
};

// Acepta un pokemon encounter cedido
const aceptarCedido = async (message) => {
  const cedido = pokemonesPorCeder.find(
    (encounter) => encounter.to == message.author.id
  );
  if (cedido == undefined)
    return message.reply(
      " Nadie te ha cedido su encuentro con un pokemon salvaje"
    );
  await usersDb.setEncounterPokemon(
    message.author.id,
    message.guild.id,
    cedido.encounter
  );
  await usersDb.setEncounterPokemon(cedido.from, message.guild.id, {});
  const newPorCeder = pokemonesPorCeder.map(
    (item) => item.to != message.author.id
  );
  pokemonesPorCeder = newPorCeder;
  message.reply(
    " Aceptaste el encuentro que te habia cedido <@" +
      cedido.from +
      ">, suerte en la batalla!"
  );
};

// Muestra todos los comandos y sus descripciones
const showCommands = (message) => {
  let commandsText = "";

  commands.forEach((command) => {
    const currCommand =
      process.env.COMMAND_CHAR +
      command.name +
      " - " +
      command.description +
      "\n";
    commandsText += currCommand;
  });
  message.channel.send(commandsText);
};

// Cede el pokemon a otro usuario (reqiuere aceptacion del usuario)
const cederCurrentEncounter = async (message) => {
  const cedidoTo = getParams(message.content);
  // Return si hay mas de 1 argumentp
  if (cedidoTo.length > 1)
    return message.reply(" Solo puedes le ceder a un usuario, piensalo bien");
  if (cedidoTo.length == 0)
    return message.reply(" Arroba a alguien para cederle el pokemon");
  const cedidoId = cedidoTo[0]
    .replace("<@!", "")
    .replace(">", "")
    .replace("<@", "");
  const currentEncounter = await usersDb.getCurrentEncounter(
    message.author.id,
    message.guild.id
  );
  // Return si el usuario que quiere ceder no tiene ningun encounter
  if (currentEncounter == undefined)
    return message.reply(" No tienes ningun pokemon pendiente por capturar");
  // Return si el usuario no arrobo a nadie
  if (!message.content.includes("<@!") && !message.content.includes("<@"))
    return message.reply(" Debes arrobar a alguien para cederle el pokemon");
  const userCedio = pokemonesPorCeder.find(
    (encounter) => encounter.from == message.author.id
  );
  // Return si el usuario ya habia cedido el pokemon
  if (userCedio != undefined)
    return message.reply(
      " Ya cediste tu pokemon a <@" +
        userCedio.to +
        ">, ahora el tiene que !aceptar o !rechazar"
    );
  const cedidoTienePendiente = pokemonesPorCeder.find(
    (encounter) => encounter.to == cedidoId
  );
  // Retorna si el usuario al que le cedieron ya tiene un pendiente de aceptar
  if (cedidoTienePendiente != undefined)
    return message.channel.send(
      `<@${cedidoId}> tiene pendiente aceptar el pokemon que le cedio ${cedidoTienePendiente.from}`
    );
  // Si el usuario no habia cedido, y al que le ceden no tiene pendientes, agrega el pendiente de ceder
  if (userCedio == undefined && cedidoTienePendiente == undefined) {
    pokemonesPorCeder.push({
      from: message.author.id,
      to: cedidoId,
      encounter: currentEncounter,
    });
    return message.channel.send(
      `<@${message.author.id}> le cedio un **${currentEncounter.name}** a <@${cedidoId}> ¿ deseas !aceptar o !rechazar ?`
    );
  }
};

// Muestra el ultimo pokemon encontrado
const showCurrentEncounter = (message) => {
  const currentEncounter = usersDb
    .getCurrentEncounter(message.author.id, message.guild.id)
    .then((pokemon) => {
      if (pokemon == undefined)
        return message.reply(" No tienen ningun pokemon para capturar");
      const embed = new MessageEmbed()
        .setTitle(pokemon.name.toUpperCase())
        .setDescription(
          `<@${
            message.author.id
          }> tu  ultimo encuentro fue con un ${pokemon.name.toUpperCase()}${
            pokemon.shiny ? " Shiny" : ""
          }\n !enviar *nombre de pokemon* para intentar capturarlo`
        )
        .setColor("RED")
        .setImage(pokemon.image)
        .setFooter("Lvl " + pokemon.lvl);
      message.channel.send(embed);
    });
};

// Elije el pokemon inicial
const setInitalPokemon = async (message) => {
  const userId = message.author.id;
  const params = getParams(message.content);
  if (params.length == 0)
    return message.reply(
      " Escribe !start + nombre de pokemon, puede ser bulbasaur, squirtle o charmander"
    );
  if (params.length > 1) return message.reply(" Eleji solo 1 pokemon");
  const chosenPokemon = params[0];
  if (
    chosenPokemon != "charmander" &&
    chosenPokemon != "bulbasaur" &&
    chosenPokemon != "squirtle"
  )
    return message.reply(
      " Solo puedes elejir a bulbasaur, charmander o squirtle"
    );
  const userPokemons = await usersDb.getAllUserPokemons(
    userId,
    message.guild.id
  );
  if (userPokemons == undefined || userPokemons.length == 0) {
    await usersDb.setNewUser(userId, message.guild.id);
  }
  if (typeof userPokemons == "object" && userPokemons.length > 0) {
    return message.reply(" Ya tenés al menos un pokemon");
  }
  const img =
    chosenPokemon == "bulbasaur"
      ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png"
      : chosenPokemon == "charmander"
      ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png"
      : chosenPokemon == "squirtle"
      ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png"
      : "";
  const pokemonData = new UserPokemon(
    chosenPokemon,
    3,
    false,
    img,
    0,
    getDate()
  );
  const addedPokemon = await usersDb.addPokemon(
    userId,
    message.guild.id,
    pokemonData
  );
  message.reply(" Ahora tenes un " + chosenPokemon);
};

// Aparece un pokemon random y se le asigna el pokemon aparecido al usuario en la db
const wildPokemonAppear = async (message) => {
  amountOfMessages = 0;
  const maxLvl = await usersDb.getMaxLvl(message.author.id, message.guild.id);
  const maxPokemonsAmount = await usersDb.getMaxAmountOfPokemons(
    message.guild.id
  );
  PokeApi.getRandomPokemon(maxLvl, maxPokemonsAmount).then((pokemon) => {
    const encounterPokemon = new UserPokemon(
      pokemon.name,
      pokemon.lvl,
      pokemon.shiny,
      pokemon.image
    );
    usersDb.setEncounterPokemon(
      message.author.id,
      message.guild.id,
      encounterPokemon
    );
    const embed = new MessageEmbed()
      .setTitle(pokemon.name.toUpperCase())
      .setDescription(
        `<@${message.author.id}> se cruzó con un ${pokemon.name.toUpperCase()}${
          pokemon.shiny ? " Shiny" : ""
        } salvaje! \n !enviar *nombre de pokemon* para intentar capturarlo`
      )
      .setColor("RED")
      .setImage(pokemon.image)
      .setFooter("Lvl " + pokemon.lvl);
    if (message.channel.name != pokemonChannelName)
      message.channel.send(
        `<@${
          message.author.id
        }> te cruzaste con un pokemon ${pokemon.name.toUpperCase()}, anda a "mundo-pokemon" para capturarlo`
      );
    const mundoPokemonCHannel = getPokemonChannel();
    message.channel.send(embed);
  });
};

// Obtiene el comando del mensaje
const getCommand = (message) => {
  if (message[0] == process.env.COMMAND_CHAR) {
    const command = message.trim().split(" ")[0].substring(1);
    return command.toLowerCase();
  }
  return null;
};

// Muestra un listado con todos los pokemones de un usuario
const getAllUserPokemons = async (message) => {
  const pokemons = await usersDb.getAllUserPokemons(
    message.author.id,
    message.guild.id
  );
  if (pokemons == undefined || pokemons.length == 0) {
    message.reply(" No tienes ningun pokemon");

    return;
  }

  let pokemonsText = " Tienes " + pokemons.length + " pokemones, son:\n";
  let firstWrote = false;
  for (let i = 0; i < Math.ceil(pokemons.length / 30); i++) {
    if (firstWrote == true) pokemonsText = "";
    pokemons.slice(i * 30, (i + 1) * 30).forEach((pokemon) => {
      const shinyText = pokemon.shiny ? "shiny" : "";
      pokemonsText +=
        pokemon.name + " - Lvl " + pokemon.lvl + " " + shinyText + "\n";
    });
    firstWrote = true;
    message.author.send(pokemonsText);
  }
};

// Obtiene los parametro del mensaje
const getParams = (message) => {
  const withoutPrefix = message.slice(process.env.COMMAND_CHAR);
  const split = withoutPrefix.split(/ +/);
  const command = split[0];
  return (args = split.slice(1));
};
client.login(process.env.BOT_TOKEN);
const commands = [
  {
    name: "start",
    description:
      "!start + nombre de pokemon, solo puede ser charmander, bulbasaur o squirtle. Ej: !start charmander",
  },
  {
    name: "buscar",
    description: " usa !buscar para buscar pokemones",
  },
  {
    name: "enviar",
    description:
      "usa !enviar *nombre de pokemon* para capturar al pokemon que te encontraste",
  },
  {
    name: "pokedex",
    description:
      "usa !pokedex *nombre de pokemon* para obtener los datos de un pokemon tuyo",
  },
  {
    name: "pokemones",
    description: "Muestra tus pokemones capturados",
  },
  {
    name: "pendiente",
    description: "Muestra el ultimo pokemon que te cruzaste",
  },
  {
    name: "ceder @usuario",
    description:
      "Cede el ultimo pokemon encontrado al usuario arrobado (requiere confirmacion del arrobado)",
  },
  {
    name: "aceptar",
    description: "acepta el encuentro pokemon que alguien te cedio",
  },
  {
    name: "rechazar",
    description: "rechaza el encuentro pokemon que alguien te cedio",
  },
  {
    name: "regalar",
    description:
      "regala un pokemon tuyo a otro usuario. Ej: !regalar charizard @usuario",
  },
  {
    name: "recibir",
    description:
      "recibe un pokemon que te haya regalado otro usuario. Ej: !recibir charizard @usuario",
  },
  {
    name: "desafiar",
    description:
      "desafia a otro usuario a tener una pelea, debes elegir a quien pelear y que pokemon enviar. Ej: '!desafiar @usuario charmander'",
  },
  {
    name: "apostar",
    description:
      "Apuestas un pokemon contra otro jugador, ambos eligen que pokemon peleara y el que gane se queda con el pokemon del otro. Ej: '!apostar @usuario charmander'",
  },
];
