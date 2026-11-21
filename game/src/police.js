// police.js — Solara Bay PD. Police cars patrol the grid while the heat
// is off; when wanted > 0 they chase Marlo's car and ram it. Being caught
// only counts on foot, at a standstill, with a cruiser right on top of
// Marlo for two seconds — so a chase never busts a driver mid-mission.
import * as THREE from 'three';
import { Car, CAR_COLORS, collideCars } from './vehicles.js';
import { ROADS, collideCircle } from './city.js';
import { makeRng, clamp, angleDiff, turnToward, headingTo } from './util.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = makeRng(5150);
    this.cars = [];
    this.caughtTimer = 0;
    for (let i = 0; i < 3; i++) {
      const road = ROADS[2 + i * 2];
      const car = new Car('police', CAR_COLORS.police, road, -100 + i * 80, i % 2 === 0 ? 0 : Math.PI);
      car.topSpeed = 34;
      car.accel = 20;
      this.scene.add(car.group);
      // Light bar: two flashing boxes on the roof.
      const barGeo = new THREE.BoxGeometry(0.5, 0.16, 0.3);
      const red = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.35, 1.42, -0.25);
      const blue = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      blue.position.set(0.35, 1.42, -0.25);
      car.group.add(red);
      car.group.add(blue);
      car.userData = { red, blue, phase: i * 0.7, ramCooldown: 0 };
      this.cars.push(car);
    }
  }

  get activeCount() {
    return this.cars.filter((c) => !c.wrecked).length;
  }

  update(dt, wanted, player, effects, onBusted) {
    const px = player.inCar && player.car ? player.car.x : player.x;
    const pz = player.inCar && player.car ? player.car.z : player.z;
    const playerSpeed = player.inCar && player.car ? Math.abs(player.car.speed) : 0;
    for (const car of this.cars) {
      car.damageCooldown = Math.max(0, car.damageCooldown - dt);
      const ud = car.userData;
      ud.ramCooldown = Math.max(0, ud.ramCooldown - dt);
      // Flash the light bar whenever the heat is on.
      if (wanted > 0) {
        ud.phase += dt * 9;
        const on = Math.sin(ud.phase) > 0;
        ud.red.material.color.setHex(on ? 0xff2222 : 0x551111);
        ud.blue.material.color.setHex(on ? 0x113366 : 0x2266ff);
      } else {
        ud.red.material.color.setHex(0x551111);
        ud.blue.material.color.setHex(0x113366);
      }
      if (car.wrecked) {
        car.wreckTimer += dt;
        if (car.wreckTimer > 8) {
          // A wrecked cruiser stays out of action, then returns on patrol.
          const road = ROADS[this.rng.int(0, ROADS.length - 1)];
          car.respawn(road, this.rng.range(-140, 140), this.rng.chance(0.5) ? 0 : Math.PI);
          car.topSpeed = 34;
          car.accel = 20;
        }
        continue;
      }
      if (wanted > 0) {
        // Chase: steer toward the player, match their pace.
        const want = headingTo(car.x, car.z, px, pz);
        const dist = Math.hypot(px - car.x, pz - car.z);
        const turn = clamp(2.4 * clamp(dist / 30, 0.4, 1), 0.6, 2.4);
        car.heading = turnToward(car.heading, want, turn * dt);
        // Ram speed: a little faster than the player's cruise, slower than top.
        const target = dist > 25 ? 40 : 30;
        if (car.speed < target) car.speed += car.accel * dt;
        else car.speed -= 8 * dt;
        const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
        car.x += f.x * car.speed * dt;
        car.z += f.z * car.speed * dt;
        car.sync();
        // Ram: contact with the player's car damages it and shoves it.
        if (player.inCar && player.car && !player.car.wrecked) {
          if (collideCars(car, player.car, 3.8)) {
            if (ud.ramCooldown <= 0) {
              ud.ramCooldown = 1.0;
              player.car.damage(3, effects);
              player.car.speed *= 0.9;
            }
          }
        }
        // Catch: only on foot, nearly still, cruiser close, sustained.
        if (!player.inCar && playerSpeed < 0.5) {
          if (dist < 3.2) {
            this.caughtTimer += dt;
            if (this.caughtTimer > 2) {
              this.caughtTimer = 0;
              onBusted();
              return;
            }
          } else {
            this.caughtTimer = Math.max(0, this.caughtTimer - dt * 2);
          }
        } else {
          this.caughtTimer = 0;
        }
      } else {
        // Patrol: cruise the grid, turning at intersections.
        car.drive({ forward: true, back: false, left: false, right: false }, dt);
        const nearX = ROADS.some((r) => Math.abs(car.x - r) < 2);
        const nearZ = ROADS.some((r) => Math.abs(car.z - r) < 2);
        if (nearX && nearZ && this.rng.chance(dt * 0.2)) {
          car.heading += this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        }
        if (car.x > 172 || car.x < -172 || car.z > 172 || car.z < -172) {
          car.teleport(clamp(-car.x, -150, 150), clamp(-car.z, -150, 150), car.heading + Math.PI);
        }
      }
      // Buildings stop cruisers (safety net; they drive roads).
      const fixed = collideCircle(car.x, car.z, 2.2, this.colliders);
      if (fixed) {
        car.x = fixed.x;
        car.z = fixed.z;
        car.speed *= 0.5;
        car.sync();
      }
      // Cruisers nudge each other apart.
      for (const o of this.cars) {
        if (o !== car && !o.wrecked) collideCars(car, o, 3.8);
      }
      // Smoke while damaged.
      if (car.burning && this.rng.chance(dt * 8)) effects.smokePuff(car.x, 1.2, car.z);
      else if (car.smoking && this.rng.chance(dt * 4)) effects.smokePuff(car.x, 1.0, car.z);
    }
  }
}
