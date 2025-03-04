// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 2, 100);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// Animation mixer
const mixer = new THREE.AnimationMixer(scene);

// Shared uniforms for shaders
const sharedUniforms = { time: { value: 0.0 } };

// Shaders for cyberpunk cube faces
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
        float grid = abs(sin(vUv.x * 20.0 + time)) * abs(sin(vUv.y * 20.0 + time));
        float pulse = sin(time * 3.0) * 0.2 + 0.8;
        vec3 finalColor = color * (1.0 + grid * pulse);
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Themes
const themes = {
    neon: { front: new THREE.Color(0x00ffff), back: new THREE.Color(0xff00ff), top: new THREE.Color(0xffffff), 
            bottom: new THREE.Color(0xffff00), left: new THREE.Color(0xff00ff), right: new THREE.Color(0x00ffff) },
    tron: { front: new THREE.Color(0x00b7eb), back: new THREE.Color(0xff4500), top: new THREE.Color(0xe0ffff), 
            bottom: new THREE.Color(0xffd700), left: new THREE.Color(0xff1493), right: new THREE.Color(0x7fffd4) },
    matrix: { front: new THREE.Color(0x00ff00), back: new THREE.Color(0x00cc00), top: new THREE.Color(0xffffff), 
              bottom: new THREE.Color(0x33ff33), left: new THREE.Color(0x009900), right: new THREE.Color(0x66ff66) }
};
let currentTheme = 'neon';

// Game state
let currentCubeSize = 3;
const maxCubeSize = 5;
let cubeGroup = null;
let points = 0;
let moveCount = 0;
let prestigeMultiplier = 1;
let rotationSpeed = 1;
let pointsPerClick = 1;
let currentMode = 'standard';
let timeLeft = 60;
let upgrades = { efficiency: 0, vision: 0, speed: 0 };
let timerInterval = null;

// Achievements
const achievements = {
    quickSolve: { name: "Quick Solve", description: "Solve in <20 moves", achieved: false },
    masterHacker: { name: "Master Hacker", description: "Reach Prestige 2", achieved: false },
    flawless: { name: "Flawless", description: "Solve 5x5x5 in Challenge mode", achieved: false }
};

// Create face material
function createFaceMaterial(color) {
    return new THREE.ShaderMaterial({
        uniforms: { time: sharedUniforms.time, color: { value: color } },
        vertexShader,
        fragmentShader
    });
}

// Cube creation
function createCube(size) {
    const faceColors = themes[currentTheme];
    const cubeGroup = new THREE.Group();
    const cubeGeometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            for (let k = 0; k < size; k++) {
                const x = i - (size - 1) / 2;
                const y = j - (size - 1) / 2;
                const z = k - (size - 1) / 2;

                const materials = [
                    createFaceMaterial(faceColors.right),
                    createFaceMaterial(faceColors.left),
                    createFaceMaterial(faceColors.top),
                    createFaceMaterial(faceColors.bottom),
                    createFaceMaterial(faceColors.front),
                    createFaceMaterial(faceColors.back)
                ];

                const smallCube = new THREE.Mesh(cubeGeometry, materials);
                smallCube.position.set(x, y, z);
                cubeGroup.add(smallCube);
            }
        }
    }
    scene.add(cubeGroup);
    return cubeGroup;
}

// Scramble cube
function scrambleCube(numMoves) {
    for (let m = 0; m < numMoves; m++) {
        const axes = ['x', 'y', 'z'];
        const axis = axes[Math.floor(Math.random() * 3)];
        const layerIndex = Math.floor(Math.random() * currentCubeSize);
        const position = layerIndex - (currentCubeSize - 1) / 2;
        const direction = Math.random() < 0.5 ? 1 : -1;
        rotateLayer(axis, position, direction, false);
    }
    moveCount = 0;
}

// Rotate layer with animation
function rotateLayer(axis, position, direction, animate = true) {
    const layerCubes = cubeGroup.children.filter(cube => Math.abs(cube.position[axis] - position) < 0.1);
    const layerGroup = new THREE.Group();
    layerCubes.forEach(cube => {
        cubeGroup.remove(cube);
        layerGroup.add(cube);
    });
    scene.add(layerGroup);

    const rotationAxis = new THREE.Vector3();
    rotationAxis[axis] = 1;
    const rotationAngle = direction * Math.PI / 2 * rotationSpeed * (window.shiftKey ? 2 : 1);

    if (animate) {
        const track = new THREE.NumberKeyframeTrack(
            `.rotation[${axis}]`, [0, 0.2], [0, rotationAngle]
        );
        const clip = new THREE.AnimationClip('rotate', 0.2, [track]);
        const action = mixer.clipAction(clip, layerGroup);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();

        setTimeout(() => {
            layerCubes.forEach(cube => {
                layerGroup.remove(cube);
                cubeGroup.add(cube);
            });
            scene.remove(layerGroup);
        }, 200);
    } else {
        layerGroup.rotateOnAxis(rotationAxis, rotationAngle);
        layerCubes.forEach(cube => {
            layerGroup.remove(cube);
            cubeGroup.add(cube);
        });
        scene.remove(layerGroup);
    }
}

// Initialize cube
cubeGroup = createCube(currentCubeSize);
scrambleCube(20);

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, duration, type = 'square') {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playBackgroundMusic() {
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(110, audioCtx.currentTime);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    setInterval(() => {
        oscillator.frequency.setValueAtTime(110 + currentCubeSize * 20, audioCtx.currentTime);
    }, 2000);
    return oscillator;
}
const bgMusic = playBackgroundMusic();

// Input handling
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', onKeyDown);

function onMouseDown(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cubeGroup.children);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const normal = intersect.face.normal.clone();
        const smallCube = intersect.object;

        const axis = Math.abs(normal.x) > 0.5 ? 'x' : Math.abs(normal.y) > 0.5 ? 'y' : 'z';
        const position = smallCube.position[axis];
        const direction = event.button === 0 ? 1 : -1;

        rotateLayer(axis, position, direction);
        handleMove();
    }
}

function onKeyDown(event) {
    const layer = Math.floor(currentCubeSize / 2);
    const pos = layer - (currentCubeSize - 1) / 2;
    if (event.key === 'ArrowUp') rotateLayer('x', pos, 1);
    else if (event.key === 'ArrowDown') rotateLayer('x', pos, -1);
    else if (event.key === 'ArrowLeft') rotateLayer('y', pos, 1);
    else if (event.key === 'ArrowRight') rotateLayer('y', pos, -1);
    else if (event.key === 'q') rotateLayer('z', pos, 1);
    else if (event.key === 'e') rotateLayer('z', pos, -1);
    handleMove();
}

function handleMove() {
    moveCount += 1 - upgrades.efficiency * 0.1;
    points += pointsPerClick * prestigeMultiplier;
    playSound(440, 0.1);
    if (isSolved()) handleSolve();
    updateUI();
}

// Solve check
function isSolved() {
    const faces = [
        { axis: 'z', value: (currentCubeSize - 1) / 2, materialIndex: 4 },
        { axis: 'z', value: -(currentCubeSize - 1) / 2, materialIndex: 5 },
        { axis: 'x', value: -(currentCubeSize - 1) / 2, materialIndex: 1 },
        { axis: 'x', value: (currentCubeSize - 1) / 2, materialIndex: 0 },
        { axis: 'y', value: (currentCubeSize - 1) / 2, materialIndex: 2 },
        { axis: 'y', value: -(currentCubeSize - 1) / 2, materialIndex: 3 }
    ];

    return faces.every(face => {
        const cubes = cubeGroup.children.filter(cube => Math.abs(cube.position[face.axis] - face.value) < 0.1);
        const firstColor = cubes[0].material[face.materialIndex].uniforms.color.value.getHex();
        return cubes.every(cube => cube.material[face.materialIndex].uniforms.color.value.getHex() === firstColor);
    });
}

// Handle solve
function handleSolve() {
    playSound(523, 0.5, 'triangle');
    points += 100 * prestigeMultiplier;
    checkAchievements();

    if (currentCubeSize < maxCubeSize) currentCubeSize += 1;
    else document.getElementById('prestige').style.display = 'block';
    if (currentMode === 'timed') clearInterval(timerInterval);

    // Particle effect
    const particles = createParticles();
    const particleMixer = new THREE.AnimationMixer(particles);
    const track = new THREE.Vector3KeyframeTrack('.position', [0, 1], [0, 0, 0, 0, 2, 5]);
    const clip = new THREE.AnimationClip('explode', 1, [track]);
    const action = particleMixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    setTimeout(() => scene.remove(particles), 1000);

    offerUpgrades();
    resetCube();
}

// Particle system
function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < 150; i++) {
        vertices.push((Math.random() - 0.5) * 3);
        vertices.push((Math.random() - 0.5) * 3);
        vertices.push((Math.random() - 0.5) * 3);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.1 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    return particles;
}

// Random upgrades
function offerUpgrades() {
    const options = [
        { name: "Efficiency", effect: () => upgrades.efficiency += 1, desc: "Reduces moves needed" },
        { name: "Vision", effect: () => upgrades.vision += 1, desc: "Highlights edges" },
        { name: "Speed", effect: () => upgrades.speed += 1, desc: "Faster rotations" }
    ];
    const choice = options[Math.floor(Math.random() * options.length)];
    document.getElementById('applyUpgrade').textContent = `Apply: ${choice.name} (${choice.desc})`;
    document.getElementById('applyUpgrade').onclick = () => {
        choice.effect();
        rotationSpeed = 1 + upgrades.speed * 0.2;
        document.getElementById('applyUpgrade').textContent = "Apply Random Upgrade";
        document.getElementById('applyUpgrade').onclick = offerUpgrades;
        updateUI();
    };
}

// Reset cube
function resetCube() {
    scene.remove(cubeGroup);
    cubeGroup = createCube(currentCubeSize);
    scrambleCube(currentMode === 'challenge' ? 10 : 20);
    if (currentMode === 'timed') startTimer();
    if (upgrades.vision > 0) highlightEdges();
}

// Timer
function startTimer() {
    timeLeft = 60;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 1;
        updateUI();
        if (timeLeft <= 0) {
            alert("Time's up!");
            resetCube();
        }
    }, 1000);
}

// Highlight edges for Vision upgrade
function highlightEdges() {
    cubeGroup.children.forEach(cube => {
        const isEdge = [cube.position.x, cube.position.y, cube.position.z].filter(pos => 
            Math.abs(pos) === (currentCubeSize - 1) / 2).length >= 2;
        if (isEdge) cube.material.forEach(mat => mat.uniforms.color.value.addScalar(0.2));
    });
}

// UI update
function updateUI() {
    document.getElementById('points').textContent = `Points: ${points}`;
    document.getElementById('cubeSize').textContent = `Cube Size: ${currentCubeSize}`;
    document.getElementById('moveCount').textContent = `Moves: ${Math.floor(moveCount)}`;
    document.getElementById('prestigeMultiplier').textContent = `Prestige Multiplier: ${prestigeMultiplier}`;
    document.getElementById('mode').textContent = `Mode: ${currentMode}${currentMode === 'timed' ? ` (Time: ${timeLeft}s)` : ''}`;
    document.getElementById('upgrades').innerHTML = `Upgrades - Efficiency: ${upgrades.efficiency}, Vision: ${upgrades.vision}, Speed: ${upgrades.speed}`;
}

// Event listeners
document.getElementById('hint').addEventListener('click', () => {
    if (points >= 50) {
        points -= 50;
        const edgeCubes = cubeGroup.children.filter(cube => 
            Math.abs(cube.position.x) === (currentCubeSize - 1) / 2 ||
            Math.abs(cube.position.y) === (currentCubeSize - 1) / 2 ||
            Math.abs(cube.position.z) === (currentCubeSize - 1) / 2
        );
        const hintCube = edgeCubes[Math.floor(Math.random() * edgeCubes.length)];
        hintCube.material.forEach(mat => mat.uniforms.color.value.addScalar(0.3));
        setTimeout(() => hintCube.material.forEach(mat => mat.uniforms.color.value.subScalar(0.3)), 2000);
        updateUI();
    }
});

document.getElementById('prestige').addEventListener('click', () => {
    prestigeMultiplier += 1;
    currentCubeSize = 3;
    points = 0;
    moveCount = 0;
    pointsPerClick = 1 + prestigeMultiplier * 0.5;
    rotationSpeed = 1 + upgrades.speed * 0.2;
    upgrades = { efficiency: 0, vision: 0, speed: 0 };
    scene.remove(cubeGroup);
    cubeGroup = createCube(currentCubeSize);
    scrambleCube(20);
    document.getElementById('prestige').style.display = 'none';
    updateUI();
});

document.getElementById('theme').addEventListener('change', e => {
    currentTheme = e.target.value;
    scene.remove(cubeGroup);
    cubeGroup = createCube(currentCubeSize);
    scrambleCube(20);
});

document.getElementById('modeSelect').addEventListener('change', e => {
    currentMode = e.target.value;
    if (currentMode === 'timed') startTimer();
    else if (currentMode === 'challenge') scrambleCube(10);
    else clearInterval(timerInterval);
    resetCube();
});

document.getElementById('toggleAchievements').addEventListener('click', () => {
    const list = document.getElementById('achievements-list');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    const ul = document.getElementById('achievements');
    ul.innerHTML = '';
    for (const [key, { name, description, achieved }] of Object.entries(achievements)) {
        const li = document.createElement('li');
        li.textContent = `${name}: ${description} (${achieved ? '✓' : '✗'})`;
        li.style.color = achieved ? '#00ff00' : '#ff0000';
        ul.appendChild(li);
    }
});

function checkAchievements() {
    if (moveCount < 20) achievements.quickSolve.achieved = true;
    if (prestigeMultiplier >= 2) achievements.masterHacker.achieved = true;
    if (currentCubeSize === 5 && currentMode === 'challenge') achievements.flawless.achieved = true;
}

// Background elements
const gridHelper = new THREE.GridHelper(20, 20, 0x00ffcc, 0x00ffcc);
gridHelper.position.set(0, -10, 0);
scene.add(gridHelper);

for (let i = 0; i < 15; i++) {
    const decoCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    decoCube.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    scene.add(decoCube);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    sharedUniforms.time.value += 0.02;
    mixer.update(0.02);
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});