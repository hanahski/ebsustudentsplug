// Sub-Zero balance patch — Frost Focus passive
// Loaded after mk.js and omar.js. Additive only; does not touch the engine.
//
// Passives
//   • 100 HP starting life (baseline)
//   • Frost Focus : +2 counter-damage to the next hit within 1.2s of successfully
//                   enduring a hit while blocking. Encourages blocking.
(function () {
  if (typeof mk === 'undefined' || !mk.fighters) return;
  if (mk.fighters._subzero) return;

  var LAST_TRIGGER = 0;
  var COOLDOWN_MS = 500;
  var frostWindowUntil = 0;

  var origEndure = mk.fighters.Fighter.prototype.endureAttack;
  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    try {
      if (this._name === 'subzero') {
        // If subzero is BLOCKING while enduring, open the frost window.
        var move = this.getMove && this.getMove();
        if (move && String(move.type).toLowerCase() === 'blocking') {
          frostWindowUntil = Date.now() + 1200;
        }
      }
      var game = this._game;
      if (game && game._opponents) {
        var attacker = game._opponents[this.getName()];
        if (attacker && attacker.getName() === 'subzero' && Date.now() < frostWindowUntil) {
          if (Date.now() - LAST_TRIGGER > COOLDOWN_MS) {
            LAST_TRIGGER = Date.now();
            damage += 2; // Frost Focus counter
            frostWindowUntil = 0;
            try { window.MKSFX && MKSFX.play && MKSFX.play('blockMetal', 0.6); } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return origEndure.call(this, damage, attackType);
  };

  mk.fighters._subzero = {
    maxHp: 100,
    passives: ['Frost Focus +2 counter after block (1.2s)']
  };
})();
