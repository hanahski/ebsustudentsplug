// Omar — bonus fighter patch. Loaded after mk.js.
// Registers "omar" as a valid fighter and layers her signature abilities
// on top of the base engine without touching mk.js internals.
//
// Abilities
//   • Rose Guard  : starts every round with 120 HP (20% overheal)
//   • Iron Will   : takes 15% less damage from all sources (min 1)
//   • Rose Fury   : every 3rd landed hit deals +5 bonus damage (crit)
//                   with a 500ms cooldown so multi-hit chains can't stack it.
(function () {
  if (typeof mk === 'undefined' || !mk.fighters) return;
  if (mk.fighters._omar) return;

  // 1) Register
  mk.fighters.list.omar = true;

  // 2) Buff starting HP for Omar
  var origInit = mk.fighters.Fighter.prototype.init;
  mk.fighters.Fighter.prototype.init = function (cb) {
    origInit.call(this, cb);
    if (this._name === 'omar') {
      this._life = 120;
      this._maxLife = 120;
    } else if (typeof this._maxLife === 'undefined') {
      this._maxLife = 100;
    }
    // Reset per-round counters
    comboCount.omar = 0;
    LAST_FURY = 0;
  };

  // 3) Damage modifiers: armor + rose fury crit
  var comboCount = { omar: 0 };
  var LAST_FURY = 0;
  var FURY_COOLDOWN_MS = 500;

  var origEndure = mk.fighters.Fighter.prototype.endureAttack;
  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    // Defender armor (Iron Will)
    if (this._name === 'omar') {
      var reduced = Math.max(1, Math.round(damage * 0.85));
      // Iron Will muted-hit cue if reduction actually applied
      if (reduced < damage) {
        try { window.MKSFX && MKSFX.play && MKSFX.play('block', 0.3); } catch (e) {}
      }
      damage = reduced;
    }
    // Attacker rose fury
    try {
      var game = this._game;
      if (game && game._opponents) {
        var attacker = game._opponents[this.getName()];
        if (attacker && attacker.getName() === 'omar') {
          comboCount.omar = (comboCount.omar || 0) + 1;
          if (comboCount.omar % 3 === 0 && Date.now() - LAST_FURY > FURY_COOLDOWN_MS) {
            LAST_FURY = Date.now();
            damage += 5; // Rose Fury bonus
            try { window.MKSFX && MKSFX.play && MKSFX.play('uppercut', 0.9); } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return origEndure.call(this, damage, attackType);
  };

  // Expose stats for HUD
  mk.fighters._omar = {
    maxHp: 120,
    passives: ['Rose Guard +20 HP', 'Iron Will −15% dmg', 'Rose Fury every 3rd hit +5']
  };
})();
