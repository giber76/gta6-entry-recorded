// hud.js — the heads-up display: cash, wanted stars, health, mission
// objective, radio station, speed, and the menu / win / busted screens.
export class HUD {
  constructor() {
    this.cashEl = document.getElementById('hud-cash');
    this.wantedEl = document.getElementById('hud-wanted');
    this.healthEl = document.getElementById('hud-health-fill');
    this.healthWrap = document.getElementById('hud-health');
    this.missionEl = document.getElementById('hud-mission');
    this.radioEl = document.getElementById('hud-radio');
    this.speedEl = document.getElementById('hud-speed');
    this.objectiveEl = document.getElementById('hud-objective');
    this.menuEl = document.getElementById('menu');
    this.winEl = document.getElementById('win-screen');
    this.bustedEl = document.getElementById('busted-screen');
    this.winCashEl = document.getElementById('win-cash');
    this.lastMission = -1;
    this.lastObjective = '';
  }

  fmtCash(n) {
    return '$' + n.toLocaleString('en-US');
  }

  showMenu(show) {
    this.menuEl.style.display = show ? 'flex' : 'none';
  }

  showWin(show, cash) {
    this.winEl.style.display = show ? 'flex' : 'none';
    if (show && this.winCashEl) this.winCashEl.textContent = this.fmtCash(cash);
  }

  showBusted(show) {
    this.bustedEl.style.display = show ? 'flex' : 'none';
  }

  update(s) {
    if (this.cashEl) this.cashEl.textContent = this.fmtCash(s.cash);
    if (this.wantedEl) {
      const stars = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 3 - s.wanted));
      this.wantedEl.textContent = stars;
      this.wantedEl.style.color = s.wanted > 0 ? '#ff5a4a' : '#ffd98a';
    }
    if (this.healthEl) {
      this.healthEl.style.width = Math.max(0, s.health) + '%';
      this.healthEl.style.background = s.health > 50 ? '#4caf50' : s.health > 25 ? '#ff9800' : '#f44336';
    }
    if (this.radioEl) this.radioEl.textContent = '♪ ' + s.radio;
    if (this.speedEl) {
      this.speedEl.textContent = s.inCar ? Math.round(s.speedKmh) + ' km/h' : '';
    }
    if (this.missionEl) {
      const names = ['M1 · The First Coupe', 'M2 · Lose the Heat', 'M3 · The Package', 'M4 · Marina Showdown', 'M5 · The Bank Job', 'M6 · The Last Job'];
      this.missionEl.textContent = s.mission < 6 ? names[s.mission] : 'Free Roam';
    }
    if (this.objectiveEl && s.objective !== this.lastObjective) {
      this.objectiveEl.textContent = s.objective;
      this.lastObjective = s.objective;
    }
  }
}
