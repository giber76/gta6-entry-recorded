// police.js — the Solara Bay police: three cruisers with flashing light bars.
// They patrol while the heat is off, chase and ram when wanted > 0, and
// bust Marlo if they pin him down on foot.
import { Car } from './vehicles.js';
import { ROADS } from './city.js';
import { dist2, headingTo } from './util.js';

export class Police {
  constructor(scene, rng) {
    this.scene = scene;
    this.cruisers = [];
    const starts = [
      { x: -80, z: -80 },
      { x: 80, z: 80 },
      { x: 0, z: -120 },
    ];
    for (let i = 0; i < 3; i++) {
      const car = new Car(scene, starts[i].x, starts[i].z, 0, 0x1a1a22, 'police');
      car.speed = 10;
      car.patrolIndex = 0;
      car.patrol = [
        { x: -120, z: -120 },
        { x: 120, z: -120 },
        { x: 120, z: 120 },
        { x: -120, z: 120 },
      ];
      car.pinTimer = 0;
      this.cruisers.push(car);
    }
  }

  update(dt, game) {
    const player = game.player;
    const wanted = game.wanted;
    for (const car of this.cruisers) {
      if (car.wrecked) {
        if (car.wreckTimer <= 0) {
          car.repair();
          // Respawn on a road away from the player.
          car.x = player.x > 0 ? -120 : 120;
          car.z = player.z > 0 ? -120 : 120;
          car.heading = 0;
          car.speed = 10;
          car.syncMesh();
        }
        continue;
      }
      if (wanted > 0) {
        // Chase: steer at the player, a touch slower than his top speed.
        const want = headingTo(car.x, car.z, player.x, player.z);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        car.speed += (40 - car.speed) * Math.min(1, dt * 0.8);
        const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
        car.x += f.x * car.speed * dt;
        car.z += f.z * car.speed * dt;
        const fixed = game.city.resolveCircle(car.x, car.z, 1.4);
        car.x = fixed.x;
        car.z = fixed.z;
        // Ram the player's car.
        const pc = player.car;
        if (pc && !pc.wrecked) {
          const d = dist2(car.x, car.z, pc.x, pc.z);
          if (d < 3.6 && car.ramCooldown <= 0) {
            car.ramCooldown = 1.2;
            pc.damage(4, game);
            pc.speed *= 0.9;
            game.shake = Math.max(game.shake, 0.25);
          }
        }
        // Pin Marlo down on foot: busted after 2 seconds inside 2.2 m.
        if (!player.car) {
          const d = dist2(car.x, car.z, player.x, player.z);
          if (d < 2.2) {
            car.pinTimer += dt;
            if (car.pinTimer > 2) game.setBusted();
          } else {
            car.pinTimer = 0;
          }
        } else {
          car.pinTimer = 0;
        }
      } else {
        // Patrol the big loop.
        const target = car.patrol[car.patrolIndex];
        const d = dist2(car.x, car.z, target.x, target.z);
        if (d < 8) {
          car.patrolIndex = (car.patrolIndex + 1) % car.patrol.length;
          continue;
        }
        const want = headingTo(car.x, car.z, target.x, target.z);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, diff));
        car.speed += (10 - car.speed) * Math.min(1, dt);
        const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
        car.x += f.x * car.speed * dt;
        car.z += f.z * car.speed * dt;
        car.pinTimer = 0;
      }
      car.syncMesh();
      car.update(dt, game);
    }
  }

  positions() {
    return this.cruisers
      .filter((c) => !c.wrecked)
      .map((c) => ({ x: c.x, z: c.z }));
  }
}
