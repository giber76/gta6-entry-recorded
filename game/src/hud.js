// hud.js — the DOM heads-up display for Solara Bay.
// Cash, health, wanted stars, mission objective, radio, speed, weapon,
// toast messages, the damage flash and the menu / win / busted overlays.
export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'health-fill', 'health-num', 'wanted', 'objective', 'radio', 'speed', 'weapon', 'clock', 'toast', 'flash', 'menu', 'win', 'busted', 'mission-title']) {
      this.el[id] = document.getElementById(id);
    }
    this._toastTimer = null;
  }

  toast(msg, ms = 4200) {
    const t = this.el.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  flashDamage() {
    const f = this.el.flash;
    if (!f) return;
    f.classList.remove('hit');
    void f.offsetWidth;
    f.classList.add('hit');
  }

  update(g) {
    const p = g.player;
    if (this.el.cash) this.el.cash.textContent = '$' + p.cash.toLocaleString('en-US');
    if (this.el['health-fill']) this.el['health-fill'].style.width = Math.max(0, p.health) + '%';
    if (this.el['health-num']) this.el['health-num'].textContent = Math.round(p.health);
    if (this.el.wanted) {
      this.el.wanted.textContent = '★'.repeat(g.wanted) + '☆'.repeat(3 - g.wanted);
      this.el.wanted.style.color = g.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    }
    if (this.el.objective) {
      const m = g.missions;
      if (g.state === 'won') this.el.objective.textContent = 'All jobs done — $12,000. Free roam!';
      else if (m.mission >= 6) this.el.objective.textContent = 'Free roam — enjoy Solara Bay.';
      else this.el.objective.textContent = 'M' + (m.mission + 1) + ' — ' + this._missionName(m.mission) + ': ' + this._hint(m);
    }
    if (this.el.radio) this.el.radio.textContent = '♪ ' + g.audio.stationName();
    if (this.el.speed) {
      this.el.speed.textContent = p.inCar && p.car ? Math.round(p.car.speedKmh) + ' km/h' : '';
    }
    if (this.el.weapon) {
      this.el.weapon.textContent = p.hasPistol ? '🔫 Pistol' : '';
    }
    if (this.el.clock) {
      const s = Math.floor(g.elapsed);
      this.el.clock.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    if (this.el['mission-title']) {
      this.el['mission-title'].textContent = g.state === 'won' ? 'SOLARA BAY — COMPLETE' : 'SOLARA BAY';
    }
  }

  _missionName(i) {
    return ['The First Coupe', 'Lose the Heat', 'The Package', 'Marina Showdown', 'The Bank Job', 'The Last Job'][i] || '';
  }

  _hint(m) {
    const hints = [
      "Steal the coupe and bring it to Rico's Garage.",
      'Drive the rectangle at |coord| = 160 to lose the heat.',
      'Reach the pier, then deliver to Coral Junction.',
      'Clear the 3 Vipers at Marina East.',
      'Hold E at the bank vault, then escape to the safehouse.',
      'Steal the boss coupe and bring it to Rico\'s Garage.',
    ];
    return hints[m.mission] || '';
  }

  showMenu() {
    this.el.menu.style.display = 'flex';
    this.el.win.style.display = 'none';
    this.el.busted.style.display = 'none';
  }

  showWin() {
    this.el.menu.style.display = 'none';
    this.el.win.style.display = 'flex';
    this.el.busted.style.display = 'none';
  }

  showBusted() {
    this.el.menu.style.display = 'none';
    this.el.win.style.display = 'none';
    this.el.busted.style.display = 'flex';
  }

  hideOverlays() {
    this.el.menu.style.display = 'none';
    this.el.win.style.display = 'none';
    this.el.busted.style.display = 'none';
  }
}
