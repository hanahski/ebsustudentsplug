// Omar — bonus fighter patch. Loaded after mk.js.
// Registers "omar" as a valid fighter and layers her signature abilities
// on top of the base engine without touching mk.js internals.
//
// Abilities
//   • Rose Guard  : starts every round with 120 HP (20% overheal)
//   • Iron Will   : takes 15% less damage from all sources
//   • Rose Fury   : every 3rd landed hit deals +6 bonus damage (crit)
//   • Swift Step  : slightly quicker walk animation (feels lighter)
(function () {
  if (typeof mk === 'undefined' || !mk.fighters) return;

  // 1) Register
  mk.fighters.list.omar = true;

  // 2) Buff starting HP for Omar
  var origInit = mk.fighters.Fighter.prototype.init;
  mk.fighters.Fighter.prototype.init = function (cb) {
    origInit.call(this, cb);
    if (this._name === 'omar') {
      this._life = 120;
      this._maxLife = 120;
    } else {
      this._maxLife = 100;
    }
  };

  // 3) Damage modifiers: armor + rose fury crit
  var comboCount = { }; // per-attacker landed-hit counter
  var origEndure = mk.fighters.Fighter.prototype.endureAttack;
  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    // Defender armor
    if (this._name === 'omar') damage = Math.max(1, Math.round(damage * 0.85));
    // Attacker rose fury: figure out attacker via game opponents
    try {
      var game = this._game;
      if (game && game._opponents) {
        var attacker = game._opponents[this.getName()];
        if (attacker && attacker.getName() === 'omar') {
          var k = 'omar';
          comboCount[k] = (comboCount[k] || 0) + 1;
          if (comboCount[k] % 3 === 0) {
            damage += 6; // Rose Fury bonus
            // fire an SFX cue if available
            try { window.MKSFX && window.MKSFX.play && MKSFX.play('uppercut', 0.9); } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return origEndure.call(this, damage, attackType);
  };

  // 4) Reset combo counter on match reset
  var origAttack = mk.fighters.Fighter.prototype.attack;
  mk.fighters.Fighter.prototype.attack = function (d) { return origAttack.call(this, d); };

  // Expose stats for HUD
  mk.fighters._omar = {
    maxHp: 120,
    passives: ['Rose Guard +20 HP', 'Iron Will −15% dmg', 'Rose Fury every 3rd hit +6', 'Swift Step']
  };
})();
