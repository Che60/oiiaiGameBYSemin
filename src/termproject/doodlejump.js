import * as THREE from 'three';

//separate background to another div to apply hue effect
const backgroundLayer = document.createElement('div');
backgroundLayer.id = 'backgroundLayer';
backgroundLayer.style.position = 'fixed';
backgroundLayer.style.top = '0';
backgroundLayer.style.left = '0';
backgroundLayer.style.width = '100%';
backgroundLayer.style.height = '100%';
backgroundLayer.style.zIndex = '-1'; // behind everything
backgroundLayer.style.backgroundImage = 'url("/src/termproject/background.png")';
backgroundLayer.style.backgroundSize = 'cover';
backgroundLayer.style.backgroundPosition = 'center center';
backgroundLayer.style.backgroundRepeat = 'no-repeat';
backgroundLayer.style.transition = 'filter 0.1s linear'; // optional smoothness
document.body.appendChild(backgroundLayer);

// Tried using sprite material, but ended up looking washed out --> used html overlay instead
// OIIAII gif
const catGif = document.createElement('img');
catGif.src = '/src/termproject/oia.gif';
catGif.style.position = 'absolute';
catGif.style.width = '100px';  // adjust size
catGif.style.pointerEvents = 'none'; // let mouse go through
catGif.style.display = 'none'; // start hidden
document.body.appendChild(catGif);

//Cat PNG
const catImg = document.createElement('img');
catImg.src = '/src/termproject/oiiaii.png'; // your normal cat PNG
catImg.style.position = 'absolute';
catImg.style.width = '100px'; // initial size
catImg.style.pointerEvents = 'none';
catImg.style.display = 'block';
document.body.appendChild(catImg);

// Basic Scene setup
const scene = new THREE.Scene();
//Use orthographic camera instead of perspective
const aspect = window.innerWidth / window.innerHeight;
const viewSize = 20;
const camera = new THREE.OrthographicCamera(-aspect*viewSize/2, aspect*viewSize/2, viewSize/2, -viewSize/2, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setClearColor('white', 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Cloud platform PNG
const textureLoader = new THREE.TextureLoader();
const cloudTexture = textureLoader.load('/src/termproject/cloud.png');
const cloudMaterial = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true });

//Sound effects
const superJumpSound = new Audio('/src/termproject/jump2.wav'); // or .ogg or .wav
const flyModeSound = new Audio('/src/termproject/fly.wav');
const jumpSound = new Audio('/src/termproject/smalljump.wav');
flyModeSound.loop = true;

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1).normalize();
scene.add(light);
const ambLight = new THREE.AmbientLight('white', 1);
scene.add(ambLight);

// Player
const playerRadius = 0.4; // ← set this to match your new SphereGeometry radius
const playerGeometry = new THREE.SphereGeometry(playerRadius);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(player);
player.position.y = 2;

// Make player sphere transparent (physics only)
player.visible = false;

// powerup meshes and playerstate obj
const powerups = []; // stores all powerup meshes
const playerState = {
    superJump: false,
    flyMode: false,
    superJumpVisualTimer: 0,
    flyTimer: 0,
    superJumpSoundPlaying: false,
    flyModeSoundPlaying: false
};

// Platforms
const platforms = [];
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x4444ff });

// Parameters
// for platform generation
const platformsPerLayer = 4;
const platformWidth = 3;
const platformHeight = 1;
const horizontalRange = (viewSize * aspect) / 2;
const minYGap = 3;
const maxYGap = 6;
const minHorizontalGap = 5; // for example, 1.2 units apart
// platform speed
const minSpeed = 2.5;
const maxSpeed = 5;
const movingPlatformChance = 0.4;
// Power-up
const superJumpChance = 0.05; // 4% chance
const flyModeChance = 0.02;   // 2% chance
let flyModeHue = 0; // initial hue angle

// Camera
const cameraOffset = 0;
camera.position.z = 15;
camera.position.y = player.position.y - cameraOffset;

// Physics
let velocityY = 0;
const gravity = -40;
const jumpVelocity = 22;
const superJumpStrength = 4;

let previousTime = performance.now();

// Game Over flag
let isGameOver = false;

// First guaranteed platform
const firstPlatform = new THREE.Mesh(new THREE.BoxGeometry(platformWidth, 0.2, 1), platformMaterial.clone());
firstPlatform.position.set(0, player.position.y - 1.5, 0);
firstPlatform.userData.velocityX = 0;

firstPlatform.visible = false;

// Create cloud sprite to cover platform
const cloudSprite = new THREE.Sprite(cloudMaterial);
cloudSprite.scale.set(platformWidth, platformHeight, 1); // Scale cloud to match platform width, tweak multiplier to fit look
cloudSprite.position.copy(firstPlatform.position); // Initial position = same as platform
firstPlatform.userData.cloudSprite = cloudSprite; // Link cloud to platform
scene.add(cloudSprite);

scene.add(firstPlatform);
platforms.push(firstPlatform);

// Initial platform generation
let highestPlatformY = firstPlatform.position.y;
generatePlatformsUpTo(viewSize);

// Controls
const keys = { left: false, right: false };
document.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") keys.left = true;
    if (event.key === "ArrowRight") keys.right = true;
});
document.addEventListener("keyup", event => {
    if (event.key === "ArrowLeft") keys.left = false;
    if (event.key === "ArrowRight") keys.right = false;
});

// Height meter UI
const heightMeter = document.createElement('div');
heightMeter.style.position = 'absolute';
heightMeter.style.top = '10px';
heightMeter.style.right = '10px';
heightMeter.style.fontSize = '24px';
heightMeter.style.color = 'black';
heightMeter.style.fontFamily = 'Arial';
heightMeter.innerHTML = 'Score: 0';
document.body.appendChild(heightMeter);
let maxHeight = player.position.y;

// Game Over UI
const gameOverText = document.createElement('div');
gameOverText.style.position = 'absolute';
gameOverText.style.top = '50%';
gameOverText.style.left = '50%';
gameOverText.style.transform = 'translate(-50%, -50%)';
gameOverText.style.fontSize = '48px';
gameOverText.style.color = 'red';
gameOverText.style.fontFamily = 'Arial';
gameOverText.style.display = 'none';
gameOverText.innerHTML = 'Game Over';
document.body.appendChild(gameOverText);

// Platform generator
function generatePlatformsUpTo(targetY) {
    while (highestPlatformY < targetY) {
        highestPlatformY += minYGap + Math.random() * (maxYGap - minYGap);

        const currentLayerXPositions = []; // keep track of placed X positions for this layer

        for (let j = 0; j < platformsPerLayer; j++) {
            let targetX;
            let tries = 0;
            const maxTries = 20; // avoid infinite loops

            do {
                targetX = (Math.random() * 2 - 1) * horizontalRange;
                tries++;
            } while (
                currentLayerXPositions.some(x => Math.abs(x - targetX) < minHorizontalGap)
                && tries < maxTries
            );

            currentLayerXPositions.push(targetX);

            const plat = new THREE.Mesh(new THREE.BoxGeometry(platformWidth, platformHeight, 1), platformMaterial.clone());
            plat.position.set(targetX, highestPlatformY, 0);

            // Make platform invisible → physics only
            plat.visible = false;

            // Create cloud sprite to cover platform
            const cloudSprite = new THREE.Sprite(cloudMaterial);
            // Scale cloud to match platform width
            cloudSprite.scale.set(platformWidth, platformHeight, 1); // tweak multiplier to fit look
            // Initial position = same as platform
            cloudSprite.position.copy(plat.position);
            // Link cloud to platform
            plat.userData.cloudSprite = cloudSprite;
            scene.add(cloudSprite);

            // Random speed between minSpeed and maxSpeed:
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

            // Random direction:
            const direction = Math.random() < 0.5 ? -1 : 1;

            // Final velocity:
            plat.userData.velocityX = Math.random() < movingPlatformChance ? direction * speed : 0;

            scene.add(plat);
            platforms.push(plat);

            if (Math.random() < superJumpChance) {
                const powerup = new THREE.Mesh(
                    new THREE.TorusGeometry(0.25, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0xff00ff }) // Pink donut = superJump
                );
                powerup.position.set(targetX, highestPlatformY + 1.0, 0);
                powerup.userData.type = 'superJump';
                scene.add(powerup);
                powerups.push(powerup);
            } else if (Math.random() < flyModeChance) {
                const powerup = new THREE.Mesh(
                    new THREE.ConeGeometry(0.4, 0.8, 8),
                    new THREE.MeshStandardMaterial({ color: 0x00ffff }) // Cyan cone = flyMode
                );
                powerup.position.set(targetX, highestPlatformY + 1.0, 0);
                powerup.userData.type = 'flyMode';
                scene.add(powerup);
                powerups.push(powerup);
            }
        }
    }
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();
    const deltaTime = (currentTime - previousTime) / 1000;
    previousTime = currentTime;

    // Fly mode behavior
    if (playerState.flyMode) {
        playerState.flyTimer -= deltaTime;
        velocityY = 20; // strong upward constant speed during fly

        // rotate hue (disco effect)
        flyModeHue += 90 * deltaTime; // adjust speed (degrees per second)
        if (flyModeHue > 360) flyModeHue -= 360;

        backgroundLayer.style.filter = `hue-rotate(${flyModeHue}deg)`;

        if (playerState.flyTimer <= 0) {
            playerState.flyMode = false; // end fly mode

            // Reset filter to normal
            backgroundLayer.style.filter = 'none';
            
            // Stop flyMode sound
            flyModeSound.pause();
            flyModeSound.currentTime = 0;
            playerState.flyModeSoundPlaying = false;
        }
    }
    else{
        // If not in flyMode → make sure filter is normal (optional safety)
        if (backgroundLayer.style.filter !== 'none') {
            backgroundLayer.style.filter = 'none';
        }
    }

    if (!isGameOver) { // While game is not over
        // Apply gravity
        velocityY += gravity * deltaTime;
        player.position.y += velocityY * deltaTime;

        // Project player position to screen space to overlay img on top of player sphere
        const vector = new THREE.Vector3();
        vector.copy(player.position);
        vector.project(camera);

        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;

        // Update catGif position on screen
        catGif.style.left = `${halfWidth + vector.x * halfWidth - 50}px`;  // -50 to center (adjust based on gif size)
        catGif.style.top = `${halfHeight - vector.y * halfHeight - 50}px`;

        catImg.style.left = `${halfWidth + vector.x * halfWidth - 50}px`;  // -50 to center (adjust based on gif size)
        catImg.style.top = `${halfHeight - vector.y * halfHeight - 50}px`;
        
        // hide or show gif
        if (playerState.flyMode) {
            catGif.style.display = 'block';
            catImg.style.display = 'none';
        } else if (playerState.superJumpVisualTimer > 0) {
            playerState.superJumpVisualTimer -= deltaTime;
            catGif.style.display = 'block';
            catImg.style.display = 'none';
        } else {
            catGif.style.display = 'none';
            catImg.style.display = 'block';
        }

        // Move player
        if (keys.left) player.position.x -= 5 * deltaTime;
        if (keys.right) player.position.x += 5 * deltaTime;

        // Horizontal screen wrap
        if (player.position.x < -horizontalRange) {
            player.position.x = horizontalRange;
        }
        if (player.position.x > horizontalRange) {
            player.position.x = -horizontalRange;
        }

        // Collision detection
        const playerBox = new THREE.Box3().setFromObject(player);
        
        platforms.forEach(p => {
            const platBox = new THREE.Box3().setFromObject(p);
            // condition 1,2: check y-axis overlap 3,4: x-axis overlap. 5: falling, not rising. 6: player above the platform
            if (playerBox.max.y > platBox.min.y && playerBox.min.y < platBox.max.y &&
                playerBox.min.x < platBox.max.x && playerBox.max.x > platBox.min.x &&
                velocityY < 0 &&
                (player.position.y - playerRadius) >= p.position.y) {

                player.position.y = p.position.y + platformHeight / 2 + playerRadius + 0.1;
                // Check if super jump active:
                if (playerState.superJump) {
                    velocityY = jumpVelocity * superJumpStrength;
                    playerState.superJump = false; // reset after use
                    // Start GIF display after landing with superJump
                    playerState.superJumpVisualTimer = 2; // show GIF for 2s
                    
                    // Play superJump sound, but only if flyMode is not active
                    if (!playerState.flyModeSoundPlaying) {
                        superJumpSound.currentTime = 0;
                        superJumpSound.play();
                        playerState.superJumpSoundPlaying = true;
                    }
                } else {
                    velocityY = jumpVelocity;
                    jumpSound.currentTime = 0;
                    jumpSound.play();
                }
            }
        });

        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            const powerupBox = new THREE.Box3().setFromObject(p);

            if (playerBox.intersectsBox(powerupBox)) {
                if (p.userData.type === 'superJump') {
                    playerState.superJump = true;
                } else if (p.userData.type === 'flyMode') {
                    playerState.flyMode = true;
                    playerState.flyTimer = 10; // seconds of fly time

                    // If flyMode sound not playing -> start sound
                    if (!playerState.flyModeSoundPlaying) {
                        flyModeSound.currentTime = 0;
                        flyModeSound.play();
                        playerState.flyModeSoundPlaying = true;
                    }

                    // If superJump sound is playing -> stop sound
                    if (playerState.superJumpSoundPlaying) {
                        superJumpSound.pause();
                        superJumpSound.currentTime = 0;
                        playerState.superJumpSoundPlaying = false;
                    }
                }
                // Remove powerup after collection
                scene.remove(p);
                powerups.splice(i, 1);
            }
        }

        // Move camera with player
        if (player.position.y > camera.position.y + cameraOffset) {
            camera.position.y = player.position.y - cameraOffset;
        }

        // Spawn new platforms
        generatePlatformsUpTo(player.position.y + viewSize);

        // Remove off-screen platforms
        for (let i = platforms.length - 1; i >= 0; i--) {
            if (platforms[i].position.y < camera.position.y - 15) {
                scene.remove(platforms[i]);
                platforms.splice(i, 1);
            }
        }

        // Move moving platforms + update color
        platforms.forEach(p => {
            if (p.userData.velocityX !== 0) {
                p.position.x += p.userData.velocityX * deltaTime;

                // Reverse if out of bounds
                if (p.position.x < -horizontalRange + platformWidth / 2 || p.position.x > horizontalRange - platformWidth / 2) {
                    p.userData.velocityX *= -1;
                }
            }
            // Sync cloud sprite position to platform
            if (p.userData.cloudSprite) {
                p.userData.cloudSprite.position.copy(p.position);
            }
        });

        // Update max height
        if (player.position.y > maxHeight) {
            maxHeight = player.position.y;
        }
        heightMeter.innerHTML = 'Score: ' + Math.floor(maxHeight);

        // Game over check
        if (player.position.y < camera.position.y - 12) {
            isGameOver = true;
            gameOverText.innerHTML = 'Game Over<br>Final Score: ' + Math.floor(maxHeight);
            gameOverText.style.display = 'block';
        }
    }

    renderer.render(scene, camera);
}
animate();