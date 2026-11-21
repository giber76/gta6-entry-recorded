// police.js — the wanted system for Solara Bay.
// Police cars spawn at a distance when wanted > 0, chase the player, and
// ram the player's car. They only bust the player when they sit on top of a
// slow or stationary target for a few seconds, so a fast getaway is safe.
import { Car } from './vehicles.js';
import { clamp, dist2, angleDiff } from './util.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.bustTime = 0;
    this.spawnAcc = 0;
  }

  wantedCount(wanted) {
    return wanted <= 0 ? 0 : Math.min(3, wanted);
  }

  update(dt, player, wanted) {
    const want = this.wantedCount(wanted);
    this.spawnAcc += dt;
    // spawn up to the wanted count, one at a time, ~100 m away
    if (this.cars.length < want && this.spawnAcc > 1.2) {
      this.spawnAcc = 0;
      const a = Math.random() * Math.PI * 2;
      const px = player.x + Math.cos(a) * 105;
      const pz = player.z + Math.sin(a) * 105;
      const x = clamp(px, -160, 160);
      const z = clamp(pz, -160, 160);
      const c = new Car(this.scene, { kind: 'police', color: 0x1a1d22, x, z, heading: 0 });
      c.speed = 20;
      this.cars.push(c);
    }
    // stand down when the heat is off
    if (want === 0) {
      for (const c of this.cars) this.scene.remove(c.group);
      this.cars = [];
      this.bustTime = 0;
      return false;
    }
    const px = player.inCar && player.car ? player.car.x : player.x;
    const pz = player.inCar && player.car ? player.car.z : player.z;
    const pSpeed = player.inCar && player.car ? Math.abs(player.car.speed) : 0;
    let busted = false;
    for (const c of this.cars) {
      if (c.wrecked) {
        c.wreckTimer += dt;
        if (c.wreckTimer > 8) {
          c.repair();
          const a = Math.random() * Math.PI * 2;
          c.x = clamp(px + Math.cos(a) * 105, -160, 160);
          c.z = clamp(pz + Math.sin(a) * 105, -160, 160);
          c.speed = 20;
        }
        c.sync(dt, 0);
        continue;
      }
      // steer toward the player
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      const dh = angleDiff(wantHeading, c.heading);
      c.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
      const target = d > 60 ? 40 : d > 18 ? 34 : 24;
      c.speed += clamp(target - c.speed, -14 * dt, 14 * dt);
      c.move(dt);
      // building slide
      const fixed = this.city.collideCircle(c.x, c.z, 2.2);
      c.x = fixed.x;
      c.z = fixed.z;
      // ram: close + moving = damage the player's car (or the player)
      if (d < 4.2 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.5;
        if (player.inCar && player.car) {
          const wrecked = player.car.damage(4);
          if (wrecked) return 'car-wrecked';
          // shove the player's car sideways a touch
          player.car.x += (dx / d) * 0.6;
          player.car.z += (dz / d) * 0.6;
        } else {
          player.hurt(6);
        }
        c.speed *= 0.55;
      }
      // bust: a police car sitting on a slow target
      if (d < 3.5 && pSpeed < 2 && !player.inCar) {
        this.bustTime += dt;
        if (this.bustTime > 3) busted = true;
      } else if (d < 3.5 && pSpeed < 2 && player.inCar) {
        this.bustTime += dt * 0.5;
        if (this.bustTime > 6) busted = true;
      } else {
        this.bustTime = Math.max(0, this.bustTime - dt * 2);
      }
      c.sync(dt, 0);
    }
    return busted;
  }
}
