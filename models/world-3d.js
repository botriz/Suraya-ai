import { SurayaFarmModel } from './farm.js';

export function initializeWorld(scene) {
  // ساخت یک مزرعه در دهکده
  const farm = SurayaFarmModel.createBasicFarm();
  farm.position.set(-10, 0, 5); // جای مزرعه در نقشه
  scene.add(farm);
  
  return farm;
}
