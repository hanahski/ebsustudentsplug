// Kano balance patch — Berserker passive
// Loaded after mk.js. Additive only; does not touch the engine.
//
// Passives
//   • 100 HP starting life (baseline)
//   • Berserker : while own HP <= 30, every landed hit deals +2 damage.
(function () {
  if (typeof mk === 'undefined' || !mk.fighters) return;
  if (mk.fighters._kano) return;

  var LAST_TRIGGER = 0;
  var COOLDOWN_MS = 500;

  var origEndure = mk.fighters.Fighter.prototype.endureAttack;
  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    try {
      var game = this._game;
      if (game && game._opponents) {
        var attacker = game._opponents[this.getName()];
        if (attacker && attacker.getName() === 'kano' && attacker._life <= 30) {
          if (Date.now() - LAST_TRIGGER > COOLDOWN_MS) {
            LAST_TRIGGER = Date.now();
            damage += 2; // Berserker
            try { window.MKSFX && MKSFX.play && MKSFX.play('effort', 0.5); } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return origEndure.call(this, damage, attackType);
  };

  mk.fighters._kano = {
    maxHp: 100,
    passives: ['Berserker +2 dmg when HP ≤ 30']
  };
})();
