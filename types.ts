import * as THREE from 'three';

export enum EffectType {
  // Basic Effects
  GALAXY = 'GALAXY',
  WAVE = 'WAVE',
  RAIN = 'RAIN',
  SPHERE = 'SPHERE',
  
  // Creative Effects
  CREATIVE_TEXT = 'CREATIVE_TEXT',
  CREATIVE_HEART_FIREWORK = 'CREATIVE_HEART_FIREWORK',
  CREATIVE_CAT_CAKE = 'CREATIVE_CAT_CAKE'
}

export interface EffectConfig {
  count: number;
  size: number;
  speed: number;
  color: string;
}

export interface ParticleSystem {
  init: (scene: THREE.Scene, config: EffectConfig) => void;
  update: (time: number) => void;
  cleanup: (scene: THREE.Scene) => void;
}