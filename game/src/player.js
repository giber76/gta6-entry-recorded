// player.js — Marlo on foot: walking, entering/exiting cars, health.
// Marlo is a simple built-up figure (body + head + cap) so he reads in
// third person and in screenshots.

import { clamp, forwardOf } from './util.js';
import { pushOutOfBuildings, clampToWorld } from './city.js';

export const WALK_SPEED = 7.2; // m/s — 2 game-s of W covers >10 m
export const ENTER_RANGE = 5.5;

export function createPlayer(world) {
  const THREE = window.THREE;
  const player = {
    x: 0,
    z: 0,
    heading: 0,
    health: 100,
    inCar: false,
    car: null,
    weapon: null,
    hasPistol: false,
    speed: 0,
    mesh: null,
  };

  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e8b6a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a075 });
  const cap = new THREE.MeshLambertMaterial({ color: 0xc23b2e });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), jacket);
  torso.position.y = 1.05;
  g.add(torso);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.32), jeans);
  legs.position.y = 0.38;
  g.add(legs);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.68;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.46), cap);
  hat.position.y = 1.93;
  g.add(hat);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.24), cap);
  brim.position.set(0, 1.86, 0.3);
  g.add(brim);

  player.mesh = g;
  player.mesh.position.set(player.x, 0, player.z);
  world.scene.add(player.mesh);
  world.player = player;

  player.place = function (x, z, heading) {
    player.x = x;
    player.z = z;
    if (heading !== undefined) player.heading = heading;
    player.syncMesh();
  };

  player.syncMesh = function () {
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    player.mesh.visible = !player.inCar;
  };

  player.heal = function () {
    player.health = 100;
  };

  player.hurt = function (amount) {
    if (world.state !== 'playing') return;
    player.health -= amount;
    world.hud.flashDamage();
    if (player.health <= 0) {
      player.health = 0;
      world.setState('busted');
    }
  };

  player.ejectFromCar = function () {
    if (!player.car) return;
    const car = player.car;
    player.car = null;
    player.inCar = false;
    const f = forwardOf(car.heading);
    player.place(car.x - f.x * 3, car.z - f.z * 3, car.heading);
    player.hurt(15);
    player.syncMesh();
  };

  // Nearest enterable car within range (skips wrecked cars).
  player.nearestCar = function (maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of world.cars) {
      if (car.wrecked) continue;
      const dx = car.x - player.x;
      const dz = car.z - player.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  };

  player.enterCar = function (car) {
    player.car = car;
    player.inCar = true;
    car.driver = 'player';
    player.heading = car.heading;
    player.x = car.x;
    player.z = car.z;
    player.syncMesh();
    world.missions.onEnterCar(car);
  };

  player.exitCar = function () {
    if (!player.car) return;
    const car = player.car;
    car.driver = null;
    player.car = null;
    player.inCar = false;
    const f = forwardOf(car.heading);
    player.place(car.x - f.x * 2.6, car.z - f.z * 2.6, car.heading);
    player.syncMesh();
  };

  // On-foot movement + enter/exit. dt in game seconds.
  player.update = function (dt) {
    if (world.state !== 'playing') return;
    const input = world.input;

    // E (edge) enters or exits a car.
    if (input.wasPressed('KeyE')) {
      if (player.inCar) {
        player.exitCar();
      } else {
        const car = player.nearestCar(ENTER_RANGE);
        if (car) player.enterCar(car);
      }
    }

    if (player.inCar) return; // the car drives itself (vehicles.js)

    let move = 0;
    if (input.held('KeyW') || input.held('ArrowUp')) move = 1;
    else if (input.held('KeyS') || input.held('ArrowDown')) move = -0.5;
    let turn = 0;
    if (input.held('KeyA') || input.held('ArrowLeft')) turn = -1;
    else if (input.held('KeyD') || input.held('ArrowRight')) turn = 1;

    if (turn !== 0) player.heading += turn * 2.4 * dt;
    const speed = move * WALK_SPEED;
    player.speed = speed;
    if (speed !== 0) {
      const f = forwardOf(player.heading);
      let nx = player.x + f.x * speed * dt;
      let nz = player.z + f.z * speed * dt;
      const c = clampToWorld(nx, nz);
      nx = c.x;
      nz = c.z;
      const fixed = pushOutOfBuildings(world, nx, nz, 0.6);
      player.x = fixed.x;
      player.z = fixed.z;
    } else {
      player.speed = 0;
    }
    player.syncMesh();
  };

  return player;
}
