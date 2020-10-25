class Pokemon {
  constructor(name, lvl, hp, attack, moves, image, shiny, xp = 0) {
    this.name = name;
    this.lvl = lvl;
    this.hp = hp;
    this.attack = attack;
    this.moves = moves;
    this.image = image;
    this.shiny = shiny;
    this.xp = xp;
  }
}

module.exports = Pokemon;
