const { User } = require("discord.js");

class UserPokemon {
  constructor(name, lvl, shiny, image = null, xp, timeCatched) {
    this.name = name;
    this.lvl = lvl;
    this.shiny = shiny;
    this.image = image;
    this.xp = xp;
    this.timeCatched = timeCatched;
  }
}

module.exports = UserPokemon;
