// mkjs SFX engine — reacts to fighter state transitions so it works
// identically on host and spectator (no extra network messages needed).
(function () {
  var BASE = '/mkjs/audio/';
  var files = {
    jump: 'jump.mp3', land: 'land.mp3', walk: 'walk.mp3',
    punch: 'punch.mp3', kick1: 'kick1.mp3', kick2: 'kick2.mp3', kick3: 'kick3.mp3',
    uppercut: 'uppercut.mp3', whoosh: 'whoosh.mp3',
    block: 'block.mp3', blockMetal: 'block-metal.mp3',
    body: 'body-thud.mp3', pain: 'pain.mp3', getup: 'getup.mp3',
    effort: 'effort.mp3', atmosphere: 'atmosphere.mp3'
  };

  // Pooled buffers so rapid retriggers overlap cleanly.
  var pool = {};
  function load() {
    Object.keys(files).forEach(function (k) {
      pool[k] = [];
      for (var i = 0; i < 3; i++) {
        var a = new Audio(BASE + files[k]);
        a.preload = 'auto';
        pool[k].push(a);
      }
    });
  }
  function play(name, vol) {
    var arr = pool[name]; if (!arr) return;
    // pick the first non-playing clone, else steal the oldest
    var a = arr.find(function (x) { return x.paused || x.ended; }) || arr[0];
    try {
      a.currentTime = 0;
      a.volume = vol == null ? 0.85 : vol;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function stop(name) {
    var arr = pool[name]; if (!arr) return;
    arr.forEach(function (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} });
  }

  var kickIdx = 0;
  function playKick() { kickIdx = (kickIdx + 1) % 3; play('kick' + (kickIdx + 1), 0.9); }

  var ATTACKS = { 'high-punch': 'punch', 'low-punch': 'punch',
                  'high-kick': 'kick', 'low-kick': 'kick', 'uppercut': 'uppercut' };
  var JUMPS = { 'jumping': 1, 'forward-jump': 1, 'backward-jump': 1 };
  var WALKS = { 'walking': 1, 'walking-backward': 1 };

  // Walk audio is a looped element (not from the pool).
  var walkLoop = new Audio(BASE + files.walk);
  walkLoop.loop = true; walkLoop.volume = 0.35;
  var walkers = 0;
  function walkOn()  { walkers++; if (walkers === 1) { try { walkLoop.currentTime = 0; walkLoop.play().catch(function(){}); } catch(e){} } }
  function walkOff() { walkers = Math.max(0, walkers - 1); if (walkers === 0) { try { walkLoop.pause(); } catch(e){} } }

  // Per-fighter transition tracker. Called every tick with current state.
  function makeTracker() {
    return { move: null, life: 100, wasJumping: false, wasWalking: false, effortCd: 0 };
  }

  var SFX = {
    load: load, play: play, stop: stop,
    trackers: [makeTracker(), makeTracker()],

    // Kick things off — call from a user-gesture safe moment.
    boot: function () {
      // gentle crowd bed
      try {
        var atm = pool.atmosphere && pool.atmosphere[0];
        if (atm) { atm.loop = false; atm.volume = 0.35; atm.play().catch(function(){}); }
      } catch (e) {}
    },

    // Called at ~15Hz with fighter snapshots {move,life}.
    tick: function (idx, state, opponent) {
      var t = this.trackers[idx];
      if (!t || !state) return;
      var prev = t.move;
      var cur = state.move || null;

      if (cur !== prev) {
        // Jump takeoff
        if (JUMPS[cur] && !t.wasJumping) { play('jump', 0.7); t.wasJumping = true; }
        // Landing: jumping -> non-jumping (typically 'stand')
        if (t.wasJumping && !JUMPS[cur]) { play('land', 0.75); t.wasJumping = false; }
        // Walk loop
        if (WALKS[cur] && !t.wasWalking) { walkOn(); t.wasWalking = true; }
        if (!WALKS[cur] && t.wasWalking) { walkOff(); t.wasWalking = false; }
        // Attack swing (whoosh + occasional grunt)
        if (ATTACKS[cur]) {
          play('whoosh', 0.55);
          if (t.effortCd <= 0) { play('effort', 0.5); t.effortCd = 4; }
          else t.effortCd--;
        }
        // Get up
        if ((prev === 'fall' || prev === 'knock-down') && (cur === 'stand-up' || cur === 'stand')) {
          play('getup', 0.7);
        }
        // Fall / KO thud is handled by life-drop branch below.
        t.move = cur;
      }

      // Damage taken this tick — impact + reaction
      if (typeof state.life === 'number' && state.life < t.life) {
        var dmg = t.life - state.life;
        var attackerMove = opponent && opponent.move;
        var blocking = cur === 'blocking';
        if (blocking) {
          play(dmg > 4 ? 'blockMetal' : 'block', 0.9);
        } else {
          // impact matched to attacker's move
          if (attackerMove === 'uppercut') play('uppercut', 0.95);
          else if (attackerMove === 'high-kick' || attackerMove === 'low-kick') playKick();
          else play('punch', 0.95);
          play('body', 0.7);
          play('pain', 0.7);
        }
        t.life = state.life;
      } else if (typeof state.life === 'number' && state.life > t.life) {
        // Reset (new round)
        t.life = state.life;
      }
    },

    onGameEnd: function () {
      walkers = 0; try { walkLoop.pause(); } catch (e) {}
      play('getup', 0.6);
    }
  };

  window.MKSFX = SFX;
})();
