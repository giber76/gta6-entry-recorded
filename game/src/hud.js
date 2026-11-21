// hud.js — the Solara Bay HUD: cash, wanted stars, health, speed, radio,
// mission objective, damage vignette, and the menu / win / pause overlays.
export class HUD {
  constructor() {
    this.cashEl = document.getElementById('hud-cash');
    this.wantedEl = document.getElementById('hud-wanted');
    this.healthFill = document.getElementById('hud-health-fill');
    this.speedEl = document.getElementById('hud-speed');
    this.radioEl = document.getElementById('hud-radio');
    this.objectiveEl = document.getElementById('hud-objective');
    this.vignetteEl = document.getElementById('vignette');
    this.menuEl = document.getElementById('menu');
    this.winEl = document.getElementById('win');
    this.pauseEl = document.getElementById('pause');
    this.bustedEl = document.getElementById('busted');
    this.holdEl = document.getElementById('hud-hold');
  }

  update(game) {
    if (this.cashEl) this.cashEl.textContent = '$' + game.missions.cash.toLocaleString('en-US');
    if (this.wantedEl) {
      let stars = '';
      for (let i = 0; i < 3; i++) stars += i < game.wanted ? '★' : '☆';
      this.wantedEl.textContent = stars;
      this.wantedEl.style.color = game.wanted > 0 ? '#ff4444' : '#ffd98a';
    }
    if (this.healthFill) this.healthFill.style.width = game.player.health + '%';
    if (this.speedEl) {
      this.speedEl.textContent = game.player.car
        ? Math.round(Math.abs(game.player.car.speed) * 3.6) + ' km/h'
        : '';
    }
    if (this.radioEl) this.radioEl.textContent = game.audio.stationName();
    if (this.objectiveEl) this.objectiveEl.textContent = game.missions.objectiveText();
    if (this.vignetteEl) {
      const v = Math.max(game.effects.vignette, game.player.health < 35 ? 0.35 : 0);
      this.vignetteEl.style.opacity = String(v);
    }
    if (this.holdEl) {
      if (game.missions.mission === 4 && game.missions.stage === 0 && game.missions.holdTimer > 0) {
        this.holdEl.style.display = 'block';
        this.holdEl.textContent = 'Cracking the vault… ' + Math.ceil(4 - game.missions.holdTimer) + 's — hold E';
      } else {
        this.holdEl.style.display = 'none';
      }
    }
  }

  showMenu() {
    this.setVisible(this.menuEl, true);
    this.setVisible(this.winEl, false);
    this.setVisible(this.pauseEl, false);
    this.setVisible(this.bustedEl, false);
  }

  showWin() {
    this.setVisible(this.menuEl, false);
    this.setVisible(this.winEl, true);
    this.setVisible(this.pauseEl, false);
    this.setVisible(this.bustedEl, false);
  }

  showPause(on) {
    this.setVisible(this.pauseEl, on);
  }

  showBusted() {
    this.setVisible(this.menuEl, false);
    this.setVisible(this.winEl, false);
    this.setVisible(this.pauseEl, false);
    this.setVisible(this.bustedEl, true);
  }

  hideOverlays() {
    this.setVisible(this.menuEl, false);
    this.setVisible(this.winEl, false);
    this.setVisible(this.pauseEl, false);
    this.setVisible(this.bustedEl, false);
  }

  setVisible(el, on) {
    if (el) el.style.display = on ? 'flex' : 'none';
  }
}
