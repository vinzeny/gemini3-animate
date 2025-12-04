import * as THREE from 'three';
import { EffectType, EffectConfig } from '../types';

// Shared geometry reuse to save memory
const textureLoader = new THREE.TextureLoader();
const particleTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png');
const snowflakeTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/snowflake1.png');

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private particles: THREE.Points | null = null;
  private animationId: number | null = null;
  private updateCallback: ((time: number) => void) | null = null;
  private container: HTMLElement;
  private handStateIsActive: boolean = false; 
  private audioContext: AudioContext | null = null;
  private isPlayingAudio: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.001);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.z = 50;
    this.camera.position.y = 20;
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    // Resize Handler
    window.addEventListener('resize', this.handleResize);

    this.animate();
  }

  private handleResize = () => {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const time = Date.now() * 0.001;
    
    if (this.updateCallback) {
      this.updateCallback(time);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public updateHandState(isActive: boolean) {
    this.handStateIsActive = isActive;
  }

  // Audio Player for Happy Birthday (Oscillator based to avoid external assets)
  private playBirthdaySong() {
    if (this.isPlayingAudio) return;
    this.isPlayingAudio = true;

    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioContext = new AudioContextClass();

        const ctx = this.audioContext;
        const notes = [
            { note: 261.63, dur: 0.25 }, // C4
            { note: 261.63, dur: 0.25 }, // C4
            { note: 293.66, dur: 0.5 },  // D4
            { note: 261.63, dur: 0.5 },  // C4
            { note: 349.23, dur: 0.5 },  // F4
            { note: 329.63, dur: 1.0 },  // E4

            { note: 261.63, dur: 0.25 }, // C4
            { note: 261.63, dur: 0.25 }, // C4
            { note: 293.66, dur: 0.5 },  // D4
            { note: 261.63, dur: 0.5 },  // C4
            { note: 392.00, dur: 0.5 },  // G4
            { note: 349.23, dur: 1.0 },  // F4
        ];

        let time = ctx.currentTime;
        notes.forEach((n) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.value = n.note;
            
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + n.dur - 0.05);

            osc.start(time);
            osc.stop(time + n.dur);
            time += n.dur;
        });

        // Loop simpler
        setTimeout(() => {
            if (this.isPlayingAudio) {
                this.isPlayingAudio = false; // Reset flag to allow re-trigger logic if needed or loop
                // this.playBirthdaySong(); // Uncomment to loop
            }
        }, time * 1000);

    } catch (e) {
        console.error("Audio Play Error", e);
    }
  }

  private stopAudio() {
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
    this.isPlayingAudio = false;
  }


  public setEffect(type: EffectType, config: EffectConfig) {
    // Stop Audio if switching effect
    this.stopAudio();

    // Cleanup existing
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      if (this.particles.material instanceof THREE.Material) {
        this.particles.material.dispose();
      }
      this.particles = null;
    }
    this.updateCallback = null;
    
    // Reset global rotation
    if (this.particles) {
        (this.particles as THREE.Points).rotation.set(0,0,0);
    }

    // Initialize new effect
    switch (type) {
      case EffectType.GALAXY:
        this.initGalaxy(config);
        break;
      case EffectType.WAVE:
        this.initWave(config);
        break;
      case EffectType.RAIN:
        this.initRain(config);
        break;
      case EffectType.SPHERE:
        this.initSphere(config);
        break;
      case EffectType.CREATIVE_TEXT:
        this.initCreativeText(config);
        break;
      case EffectType.CREATIVE_HEART_FIREWORK:
        this.initHeartFirework(config);
        break;
      case EffectType.CREATIVE_CAT_CAKE:
        this.initCatCake(config);
        break;
    }
  }

  // --- Helpers ---
  
  private generateCanvasPositions(text: string, count: number, drawExtra?: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void): Float32Array {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return new Float32Array(count * 3);

      const width = 512;
      const height = 512;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      
      // Draw Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 80px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, 100);

      // Draw Extra Graphics
      if (drawExtra) {
          drawExtra(ctx, width/2, 300);
      }

      // Sampling
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const validPoints: {x: number, y: number}[] = [];

      // Scan
      for (let y = 0; y < height; y += 3) {
          for (let x = 0; x < width; x += 3) {
              const i = (y * width + x) * 4;
              if (data[i] > 100) { 
                  validPoints.push({
                      x: (x - width / 2) * 0.15,
                      y: -(y - height / 2) * 0.15
                  });
              }
          }
      }

      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const point = validPoints.length > 0 ? validPoints[i % validPoints.length] : {x:0, y:0};
          positions[i3] = point.x + (Math.random() - 0.5) * 0.5;
          positions[i3 + 1] = point.y + (Math.random() - 0.5) * 0.5;
          positions[i3 + 2] = (Math.random() - 0.5) * 2; 
      }
      return positions;
  }

  private drawLobster(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 40, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerX - 30, centerY + 60);
      ctx.lineTo(centerX + 30, centerY + 60);
      ctx.lineTo(centerX, centerY + 120);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerX - 30, centerY - 60);
      ctx.lineTo(centerX + 30, centerY - 60);
      ctx.lineTo(centerX, centerY - 90);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY - 90);
      ctx.quadraticCurveTo(centerX - 60, centerY - 150, centerX - 40, centerY - 200);
      ctx.moveTo(centerX + 10, centerY - 90);
      ctx.quadraticCurveTo(centerX + 60, centerY - 150, centerX + 40, centerY - 200);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 30, centerY - 30);
      ctx.lineTo(centerX - 80, centerY - 80);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(centerX - 90, centerY - 90, 20, 30, -Math.PI/4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerX + 30, centerY - 30);
      ctx.lineTo(centerX + 80, centerY - 80);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(centerX + 90, centerY - 90, 20, 30, Math.PI/4, 0, Math.PI * 2);
      ctx.fill();
  }

  // --- Effect Implementations ---

  private initGalaxy(config: EffectConfig) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const colors = new Float32Array(config.count * 3);
    const colorInside = new THREE.Color(config.color);
    const colorOutside = new THREE.Color(0x1b3984); 

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 50;
      const spinAngle = radius * 0.5;
      const branchAngle = (i % 3) * ((Math.PI * 2) / 3);
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      const mixedColor = colorInside.clone().lerp(colorOutside, radius / 50);
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: config.size,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      map: particleTexture,
      transparent: true
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    this.updateCallback = (time) => {
      if (this.particles) {
        this.particles.rotation.y = time * config.speed * 0.1;
      }
    };
  }

  private initCreativeText(config: EffectConfig) {
    const count = config.count;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    // 1. Galaxy Positions
    const galaxyPositions = new Float32Array(count * 3);
    const colorInside = new THREE.Color(config.color);
    const colorOutside = new THREE.Color(0x1b3984);
    const colorText = new THREE.Color(config.color); 

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 50;
      const spinAngle = radius * 0.5;
      const branchAngle = (i % 3) * ((Math.PI * 2) / 3);
      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.5 * radius);

      galaxyPositions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      galaxyPositions[i3 + 1] = randomY;
      galaxyPositions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      positions[i3] = galaxyPositions[i3];
      positions[i3 + 1] = galaxyPositions[i3 + 1];
      positions[i3 + 2] = galaxyPositions[i3 + 2];

      const mixedColor = colorInside.clone().lerp(colorOutside, radius / 50);
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    // 2. Text + Lobster Positions
    const textPositions = this.generateCanvasPositions("小龙虾", count, this.drawLobster);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: config.size,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      map: particleTexture,
      transparent: true
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    let currentRotationY = 0;

    this.updateCallback = (time) => {
       if (!this.particles) return;
       const pos = this.particles.geometry.attributes.position.array as Float32Array;
       const col = this.particles.geometry.attributes.color.array as Float32Array;
       
       if (this.handStateIsActive) { // Victory Gesture -> Crayfish
         currentRotationY += (0 - currentRotationY) * 0.1;
         this.particles.rotation.y = currentRotationY;

         for(let i = 0; i < count; i++) {
           const i3 = i * 3;
           pos[i3] += (textPositions[i3] - pos[i3]) * 0.08;
           pos[i3 + 1] += (textPositions[i3 + 1] - pos[i3 + 1]) * 0.08;
           pos[i3 + 2] += (textPositions[i3 + 2] - pos[i3 + 2]) * 0.08;
           
           col[i3] += (colorText.r - col[i3]) * 0.05;
           col[i3 + 1] += (colorText.g - col[i3 + 1]) * 0.05;
           col[i3 + 2] += (colorText.b - col[i3 + 2]) * 0.05;
         }
       } else { // Galaxy
         currentRotationY += config.speed * 0.002;
         this.particles.rotation.y = currentRotationY;
         const baseColor = new THREE.Color(config.color);
         
         for(let i = 0; i < count; i++) {
           const i3 = i * 3;
           pos[i3] += (galaxyPositions[i3] - pos[i3]) * 0.08;
           pos[i3 + 1] += (galaxyPositions[i3 + 1] - pos[i3 + 1]) * 0.08;
           pos[i3 + 2] += (galaxyPositions[i3 + 2] - pos[i3 + 2]) * 0.08;

           const dx = galaxyPositions[i3];
           const dz = galaxyPositions[i3+2];
           const radius = Math.sqrt(dx*dx + dz*dz);
           const targetColor = baseColor.clone().lerp(colorOutside, radius / 50);

           col[i3] += (targetColor.r - col[i3]) * 0.05;
           col[i3 + 1] += (targetColor.g - col[i3 + 1]) * 0.05;
           col[i3 + 2] += (targetColor.b - col[i3 + 2]) * 0.05;
         }
       }
       this.particles.geometry.attributes.position.needsUpdate = true;
       this.particles.geometry.attributes.color.needsUpdate = true;
    };
  }

  private initHeartFirework(config: EffectConfig) {
    const count = config.count;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const heartPositions = new Float32Array(count * 3);
    const heartColors = new Float32Array(count * 3);
    const colorBase = new THREE.Color(config.color);
    const colorEdge = new THREE.Color(0xff0066);
    const skyBlue = new THREE.Color(0x87CEEB); 

    for (let i = 0; i < config.count; i++) {
        const i3 = i * 3;
        const t = Math.random() * Math.PI * 2;
        const thickness = (Math.random() - 0.5) * 4;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        let z = thickness;
        x *= (0.8 + Math.random() * 0.2) * 1.2;
        y *= (0.8 + Math.random() * 0.2) * 1.2;
        z *= 2; 

        heartPositions[i3] = x;
        heartPositions[i3 + 1] = y;
        heartPositions[i3 + 2] = z;
        
        const mixedColor = colorBase.clone().lerp(colorEdge, (y + 15) / 30);
        heartColors[i3] = mixedColor.r;
        heartColors[i3+1] = mixedColor.g;
        heartColors[i3+2] = mixedColor.b;

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        colors[i3] = mixedColor.r;
        colors[i3+1] = mixedColor.g;
        colors[i3+2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: config.size,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      map: snowflakeTexture,
      transparent: true
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    let phase = 0;
    let launchHeight = 0;
    const explosionVelocities = new Float32Array(count * 3);
    
    const setExplosionVelocity = (index3: number) => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const speed = Math.random() * 1.5 + 0.5; 
        explosionVelocities[index3] = Math.sin(phi) * Math.cos(theta) * speed;
        explosionVelocities[index3+1] = Math.sin(phi) * Math.sin(theta) * speed;
        explosionVelocities[index3+2] = Math.cos(phi) * speed;
    };

    this.updateCallback = (time) => {
        if (!this.particles) return;
        const pos = this.particles.geometry.attributes.position.array as Float32Array;
        const col = this.particles.geometry.attributes.color.array as Float32Array;

        if (this.handStateIsActive) { // Fist detected
           if (phase === 0) {
              phase = 1;
              launchHeight = 0;
           }
        } else {
           if (phase !== 0) phase = 0;
        }

        if (phase === 0) { // Heart
            this.particles.rotation.y = Math.sin(time * 0.5) * 0.3;
            for(let i = 0; i < count; i++) {
                const i3 = i * 3;
                pos[i3] += (heartPositions[i3] - pos[i3]) * 0.08;
                pos[i3 + 1] += (heartPositions[i3 + 1] - pos[i3 + 1]) * 0.08;
                pos[i3 + 2] += (heartPositions[i3 + 2] - pos[i3 + 2]) * 0.08;
                col[i3] += (heartColors[i3] - col[i3]) * 0.08;
                col[i3 + 1] += (heartColors[i3 + 1] - col[i3 + 1]) * 0.08;
                col[i3 + 2] += (heartColors[i3 + 2] - col[i3 + 2]) * 0.08;
            }
        } 
        else if (phase === 1) { // Launch
            this.particles.rotation.y += 0.1; 
            launchHeight += 1.5;
            for(let i = 0; i < count; i++) {
                const i3 = i * 3;
                const tx = 0; const ty = (Math.random() - 0.5) * 5; const tz = 0;
                pos[i3] += (tx - pos[i3]) * 0.15;
                pos[i3 + 2] += (tz - pos[i3 + 2]) * 0.15;
                pos[i3 + 1] += ((launchHeight + ty) - pos[i3 + 1]) * 0.15;
                col[i3] += (skyBlue.r - col[i3]) * 0.15;
                col[i3 + 1] += (skyBlue.g - col[i3 + 1]) * 0.15;
                col[i3 + 2] += (skyBlue.b - col[i3 + 2]) * 0.15;
            }
            if (launchHeight > 60) {
                phase = 2;
                for(let i = 0; i < count; i++) setExplosionVelocity(i * 3);
            }
        }
        else if (phase === 2) { // Explode
            for(let i = 0; i < count; i++) {
                const i3 = i * 3;
                pos[i3] += explosionVelocities[i3];
                pos[i3 + 1] += explosionVelocities[i3 + 1];
                pos[i3 + 2] += explosionVelocities[i3 + 2];
                explosionVelocities[i3 + 1] -= 0.02; 
                explosionVelocities[i3] *= 0.98;
                explosionVelocities[i3+1] *= 0.98;
                explosionVelocities[i3+2] *= 0.98;

                if (pos[i3 + 1] < -100 && this.handStateIsActive) {
                    pos[i3] = (Math.random() - 0.5) * 2;
                    pos[i3 + 1] = 60 + (Math.random() - 0.5) * 5;
                    pos[i3 + 2] = (Math.random() - 0.5) * 2;
                    setExplosionVelocity(i3);
                    col[i3] = skyBlue.r; col[i3+1] = skyBlue.g; col[i3+2] = skyBlue.b;
                }
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
  }

  // CAT CAKE EFFECT
  private initCatCake(config: EffectConfig) {
      const count = config.count;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count); // For rain
      const colors = new Float32Array(count * 3);
      
      // Rain Positions (Default)
      for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          positions[i3] = (Math.random() - 0.5) * 200;
          positions[i3 + 1] = (Math.random() - 0.5) * 200;
          positions[i3 + 2] = (Math.random() - 0.5) * 200;
          velocities[i] = Math.random() * 0.5 + 0.5;
          colors[i3] = 1; colors[i3+1] = 1; colors[i3+2] = 1; // White rain
      }

      // Cake + Text Target Positions
      const cakePositions = new Float32Array(count * 3);
      const cakeColors = new Float32Array(count * 3);
      const textPositions = this.generateCanvasPositions("生日快乐", count / 4); // Use subset for text
      
      const cakeColor1 = new THREE.Color(0xFF69B4); // Pink
      const cakeColor2 = new THREE.Color(0xFFFFFF); // Cream
      const flameColor = new THREE.Color(0xFFA500); // Orange

      // Build Cake Geometry target
      let idx = 0;
      // 1. Base Layer (Cylinder)
      const baseCount = Math.floor(count * 0.4);
      for (let i = 0; i < baseCount; i++) {
          const i3 = idx * 3;
          const theta = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 25; // Radius 25
          const h = (Math.random() - 0.5) * 15 - 10; // Y from -17.5 to -2.5
          cakePositions[i3] = r * Math.cos(theta);
          cakePositions[i3+1] = h;
          cakePositions[i3+2] = r * Math.sin(theta);
          
          cakeColors[i3] = cakeColor1.r; cakeColors[i3+1] = cakeColor1.g; cakeColors[i3+2] = cakeColor1.b;
          idx++;
      }
      // 2. Top Layer
      const topCount = Math.floor(count * 0.3);
      for (let i = 0; i < topCount; i++) {
          const i3 = idx * 3;
          const theta = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 18;
          const h = (Math.random() - 0.5) * 10 + 5; // Y from 0 to 10
          cakePositions[i3] = r * Math.cos(theta);
          cakePositions[i3+1] = h;
          cakePositions[i3+2] = r * Math.sin(theta);
          
          cakeColors[i3] = cakeColor2.r; cakeColors[i3+1] = cakeColor2.g; cakeColors[i3+2] = cakeColor2.b;
          idx++;
      }
      // 3. Candle
      const candleCount = Math.floor(count * 0.05);
      for (let i = 0; i < candleCount; i++) {
           const i3 = idx * 3;
           const theta = Math.random() * Math.PI * 2;
           const r = Math.sqrt(Math.random()) * 1.5; 
           const h = (Math.random()) * 10 + 10; // Y 10 to 20
           cakePositions[i3] = r * Math.cos(theta);
           cakePositions[i3+1] = h;
           cakePositions[i3+2] = r * Math.sin(theta);
           cakeColors[i3] = 1; cakeColors[i3+1] = 0; cakeColors[i3+2] = 0; // Red candle
           idx++;
      }
      // 4. Text (Birthday) - placed below
      const textCount = Math.floor(count * 0.2); 
      for (let i = 0; i < textCount; i++) {
          const i3 = idx * 3;
          const tIdx = (i % (textPositions.length/3)) * 3;
          cakePositions[i3] = textPositions[tIdx];
          cakePositions[i3+1] = textPositions[tIdx+1] - 40; // Shift down
          cakePositions[i3+2] = textPositions[tIdx+2];
          cakeColors[i3] = 1; cakeColors[i3+1] = 1; cakeColors[i3+2] = 0; // Yellow Text
          idx++;
      }
      // 5. Flame (Remaining)
      const flameStartIndex = idx;
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        map: particleTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.particles = new THREE.Points(geometry, material);
      this.scene.add(this.particles);

      let isCatDetected = false;

      this.updateCallback = (time) => {
          if (!this.particles) return;
          const pos = this.particles.geometry.attributes.position.array as Float32Array;
          const col = this.particles.geometry.attributes.color.array as Float32Array;

          if (this.handStateIsActive && !isCatDetected) {
              isCatDetected = true;
              this.playBirthdaySong();
          } else if (!this.handStateIsActive && isCatDetected) {
              isCatDetected = false;
              // this.stopAudio(); // Optional: Stop audio immediately or let it finish loop
          }

          if (isCatDetected) {
              // --- CAKE MODE ---
              this.particles.rotation.y = Math.sin(time * 0.5) * 0.2;

              // Lerp static parts
              for (let i = 0; i < flameStartIndex; i++) {
                  const i3 = i * 3;
                  pos[i3] += (cakePositions[i3] - pos[i3]) * 0.05;
                  pos[i3+1] += (cakePositions[i3+1] - pos[i3+1]) * 0.05;
                  pos[i3+2] += (cakePositions[i3+2] - pos[i3+2]) * 0.05;
                  
                  col[i3] += (cakeColors[i3] - col[i3]) * 0.05;
                  col[i3+1] += (cakeColors[i3+1] - col[i3+1]) * 0.05;
                  col[i3+2] += (cakeColors[i3+2] - col[i3+2]) * 0.05;
              }

              // Dynamic Flame
              for (let i = flameStartIndex; i < count; i++) {
                   const i3 = i * 3;
                   // Reset if high
                   if (pos[i3+1] > 28 || Math.random() < 0.05) {
                       const theta = Math.random() * Math.PI * 2;
                       const r = Math.random() * 2;
                       pos[i3] = r * Math.cos(theta);
                       pos[i3+1] = 20; // Top of candle
                       pos[i3+2] = r * Math.sin(theta);
                       
                       col[i3] = 1; col[i3+1] = 1; col[i3+2] = 0; // Yellow base
                   }
                   
                   pos[i3+1] += 0.2; // Rise
                   pos[i3] += (Math.random() - 0.5) * 0.2; // Jitter
                   
                   // Color shift to red
                   col[i3] += (1 - col[i3]) * 0.1;
                   col[i3+1] -= 0.02; // Green down -> Red
               }

          } else {
              // --- RAIN MODE ---
              this.particles.rotation.y = 0;
              for(let i = 0; i < count; i++) {
                const i3 = i * 3;
                // Gravity
                pos[i3 + 1] -= velocities[i] * config.speed;
                // Reset
                if (pos[i3 + 1] < -100) {
                    pos[i3] = (Math.random() - 0.5) * 200;
                    pos[i3 + 1] = 100;
                    pos[i3 + 2] = (Math.random() - 0.5) * 200;
                }
                // Color White
                col[i3] += (1 - col[i3]) * 0.1;
                col[i3+1] += (1 - col[i3+1]) * 0.1;
                col[i3+2] += (1 - col[i3+2]) * 0.1;
              }
          }
          
          this.particles.geometry.attributes.position.needsUpdate = true;
          this.particles.geometry.attributes.color.needsUpdate = true;
      }
  }

  private initWave(config: EffectConfig) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const gridSize = Math.ceil(Math.sqrt(config.count));
    const separation = 2; 
    const offset = (gridSize * separation) / 2;

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      const x = (i % gridSize) * separation - offset;
      const z = Math.floor(i / gridSize) * separation - offset;
      positions[i3] = x;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = z;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: config.size,
      color: config.color,
      map: particleTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    this.updateCallback = (time) => {
      if (!this.particles) return;
      const positions = this.particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < config.count; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const z = positions[i3 + 2];
        const y = Math.sin(x * 0.1 + time * config.speed) * 5 + Math.cos(z * 0.1 + time * config.speed) * 5;
        positions[i3 + 1] = y;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    };
  }

  private initRain(config: EffectConfig) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const velocities = new Float32Array(config.count);

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 200;
      positions[i3 + 1] = (Math.random() - 0.5) * 200;
      positions[i3 + 2] = (Math.random() - 0.5) * 200;
      velocities[i] = Math.random() * 0.5 + 0.5; 
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: config.size,
      color: config.color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    this.updateCallback = () => {
       if (!this.particles) return;
       const positions = this.particles.geometry.attributes.position.array as Float32Array;
       for(let i = 0; i < config.count; i++) {
         const i3 = i * 3;
         positions[i3 + 1] -= velocities[i] * config.speed;
         if (positions[i3 + 1] < -100) {
           positions[i3 + 1] = 100;
         }
       }
       this.particles.geometry.attributes.position.needsUpdate = true;
    };
  }

  private initSphere(config: EffectConfig) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const radius = 40;
    for (let i = 0; i < config.count; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        size: config.size,
        color: config.color,
        map: particleTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    this.updateCallback = (time) => {
        if (this.particles) {
            this.particles.rotation.y = time * config.speed * 0.2;
            this.particles.rotation.z = time * config.speed * 0.1;
            const scale = 1 + Math.sin(time * 2) * 0.05;
            this.particles.scale.set(scale, scale, scale);
        }
    }
  }

  public cleanup() {
    window.removeEventListener('resize', this.handleResize);
    this.stopAudio();
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) {
        this.renderer.dispose();
        if (this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
  }
}