import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
const words = ["STACK", "KITES", "SOURS", "SPURS"]; // Different words for each face, corners shared
const gridSize = 5;
const maxGuesses = 5;
const cubeSize = 5;
const cube = Array.from({ length: 4 }, () => Array.from({ length: gridSize }, () => Array(gridSize).fill(null))); // 3D array for the cube
const guessPositions = Array.from({ length: 4 }, () => Array.from({ length: gridSize }, () => Array(gridSize).fill({ filled: false, locked: false }))); // Track filled and locked positions for each row
const completedFaces = Array(4).fill(false); // Track completed faces
const currentGuesses = Array(4).fill(0); // Track current guess row for each face

const faceMaterials = {
    default: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    correct: new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1 }),
    present: new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1 }),
    absent: new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 }),
    otherWord: new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 1 }),
    solidWhite: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }) // For non-color changing faces
};

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = 2 * Math.PI / 3;

    camera.position.z = 10;

    window.addEventListener('keydown', onKeyDown, false);

    createCube();
}

function createCube() {
    const faceTransforms = [
        { position: [0, 0, cubeSize / 2 - 0.5], rotation: [0, 0, 0] }, // front
        { position: [cubeSize / 2 - 0.5, 0, 0], rotation: [0, Math.PI / 2, 0] }, // right
        { position: [0, 0, -cubeSize / 2 + 0.5], rotation: [0, Math.PI, 0] }, // back
        { position: [-cubeSize / 2 + 0.5, 0, 0], rotation: [0, -Math.PI / 2, 0] } // left
    ];

    ['front', 'right', 'back', 'left'].forEach((face, faceIndex) => {
        const faceGroup = new THREE.Group();
        faceGroup.position.set(...faceTransforms[faceIndex].position);
        faceGroup.rotation.set(...faceTransforms[faceIndex].rotation);
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const box = createBox();
                box.position.set(j - 2, i - 2, 0);
                faceGroup.add(box);
                cube[faceIndex][i][j] = { box, text: createTextMesh("") };
                cube[faceIndex][i][j].text.position.set(j - 2, i - 2, 0.55); // Slightly offset text
                cube[faceIndex][i][j].text.renderOrder = 1; // Ensure text is rendered above the box
                faceGroup.add(cube[faceIndex][i][j].text);
            }
        }
        scene.add(faceGroup);
        cube[faceIndex].group = faceGroup;
    });
}

function createBox() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materialArray = [
        faceMaterials.default.clone(), // Right
        faceMaterials.default.clone(), // Left
        faceMaterials.default.clone(), // Top
        faceMaterials.default.clone(), // Bottom
        faceMaterials.default.clone(), // Front
        faceMaterials.default.clone() // Back
    ];

    return new THREE.Mesh(geometry, materialArray);
}

function createTextMesh(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.font = '96px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.userData = { text };
    return mesh;
}

function updateTextMesh(mesh, text) {
    const canvas = mesh.material.map.image;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    mesh.material.map.needsUpdate = true;
    mesh.userData.text = text;
    mesh.material.opacity = 1; // Make the text visible
}

function onKeyDown(event) {
    const currentFaceIndex = getCurrentFaceIndex();
    if (completedFaces[currentFaceIndex]) return; // Prevent input for completed faces

    if (event.key >= 'a' && event.key <= 'z') {
        placeLetter(event.key.toUpperCase());
    } else if (event.key === 'Backspace') {
        removeLetter();
    } else if (event.key === 'Enter') {
        checkGuess();
    }
}

function placeLetter(letter) {
    const currentFaceIndex = getCurrentFaceIndex();
    const guessRow = currentGuesses[currentFaceIndex];
    for (let j = 0; j < gridSize; j++) {
        if (!guessPositions[currentFaceIndex][guessRow][j].filled) {
            const { text, box } = cube[currentFaceIndex][guessRow][j];
            updateTextMesh(text, letter);
            box.material[4] = faceMaterials.solidWhite.clone(); // Only update the front face
            box.material[4].opacity = 1; // Make the front face of the box visible
            guessPositions[currentFaceIndex][guessRow][j] = { filled: true, locked: false };
            updateSharedCorners(currentFaceIndex, guessRow, j, letter);
            updateSharedCornerVisibility(currentFaceIndex, guessRow, j, true); // Update visibility of the shared corner
            break;
        }
    }
}


function removeLetter() {
    const currentFaceIndex = getCurrentFaceIndex();
    const guessRow = currentGuesses[currentFaceIndex];
    for (let j = gridSize - 1; j >= 0; j--) {
        if (guessPositions[currentFaceIndex][guessRow][j].filled && !guessPositions[currentFaceIndex][guessRow][j].locked) {
            const { text, box } = cube[currentFaceIndex][guessRow][j];
            updateTextMesh(text, "");
            box.material[4].opacity = 0; // Make the front face of the box invisible
            guessPositions[currentFaceIndex][guessRow][j] = { filled: false, locked: false };
            updateSharedCorners(currentFaceIndex, guessRow, j, "");
            updateSharedCornerVisibility(currentFaceIndex, guessRow, j, false); // Update visibility of the shared corner
            break;
        }
    }
}



function updateSharedCorners(faceIndex, row, col, letter) {
    if (col === 0) {
        const leftFaceIndex = (faceIndex + 3) % 4; // Face to the left
        const leftFaceRow = row;
        const leftFaceCol = 4;
        const { text, box } = cube[leftFaceIndex][leftFaceRow][leftFaceCol];
        updateTextMesh(text, letter);
        guessPositions[leftFaceIndex][leftFaceRow][leftFaceCol] = letter ? { filled: true, locked: true } : { filled: false, locked: false };
        box.material[4].opacity = letter ? 1 : 0; // Update visibility of the shared corner
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { text, box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        updateTextMesh(text, letter);
        guessPositions[rightFaceIndex][rightFaceRow][rightFaceCol] = letter ? { filled: true, locked: true } : { filled: false, locked: false };
        box.material[4].opacity = letter ? 1 : 0; // Update visibility of the shared corner
    }
}



function updateSharedCornerVisibility(faceIndex, row, col, visible) {
    if (col === 0) {
        const leftFaceIndex = (faceIndex + 3) % 4; // Face to the left
        const leftFaceRow = row;
        const leftFaceCol = 4;
        const { box } = cube[leftFaceIndex][leftFaceRow][leftFaceCol];
        box.material[4].opacity = visible ? 1 : 0; // Update the front face visibility
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        box.material[4].opacity = visible ? 1 : 0; // Update the front face visibility
    }
}



async function checkGuess() {
    const currentFaceIndex = getCurrentFaceIndex();
    const guessRow = currentGuesses[currentFaceIndex];

    // Ensure the current row is fully filled before allowing submission
    if (!isRowFilled(currentFaceIndex, guessRow)) {
        return;
    }

    const guess = [];
    for (let j = 0; j < gridSize; j++) {
        guess.push(cube[currentFaceIndex][guessRow][j].text.userData.text);
    }

    const isValid = await isValidWord(guess.join(''));
    if (!isValid) {
        alert('Invalid word!');
        return;
    }

    const word = words[currentFaceIndex];
    const wordCounts = getCounts(word);
    const guessCounts = getCounts(guess.join(''));

    // First pass for correct letters
    for (let j = 0; j < gridSize; j++) {
        const letter = guess[j];
        if (letter === word[j]) {
            updateBoxColor(currentFaceIndex, guessRow, j, 'correct');
            updateCornerBoxColor(currentFaceIndex, guessRow, j, 'correct');
            wordCounts[letter]--;
            guessCounts[letter]--;
        }
    }

    // Second pass for present and absent letters
    for (let j = 0; j < gridSize; j++) {
        const letter = guess[j];
        if (letter !== word[j]) {
            if (wordCounts[letter] > 0) {
                updateBoxColor(currentFaceIndex, guessRow, j, 'present');
                updateCornerBoxColor(currentFaceIndex, guessRow, j, 'present');
                wordCounts[letter]--;
            } else {
                updateBoxColor(currentFaceIndex, guessRow, j, 'absent');
                updateCornerBoxColor(currentFaceIndex, guessRow, j, 'absent');
            }
        }
    }

    // Check for letters in other words
    for (let j = 0; j < gridSize; j++) {
        if (cube[currentFaceIndex][guessRow][j].box.material[4].color.equals(faceMaterials.absent.color)) {
            const letter = guess[j];
            for (let k = 0; k < 4; k++) {
                if (k !== currentFaceIndex && words[k].includes(letter)) {
                    updateBoxColor(currentFaceIndex, guessRow, j, 'otherWord');
                    updateCornerBoxColor(currentFaceIndex, guessRow, j, 'otherWord');
                    break;
                }
            }
        }
    }

    if (guess.join('') === word) {
        completedFaces[currentFaceIndex] = true;
    }
    currentGuesses[currentFaceIndex]++;

    // Lock the letters in the guess
    for (let j = 0; j < gridSize; j++) {
        guessPositions[currentFaceIndex][guessRow][j].locked = true;
    }

    // Check for win/loss conditions
    if (checkLossCondition()) {
        alert('You lose!');
        return;
    }

    if (checkWinCondition()) {
        alert('You win!');
        return;
    }

    // Check if all faces have guessed for the current row before allowing progression to the next row
    if (allFacesGuessedForCurrentRow()) {
        incrementGuessRow();
    }
}

async function isValidWord(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = await response.json();
        return !data.title; // If there is no title, the word is valid
    } catch (error) {
        console.error('Error validating word:', error);
        return false; // If there's an error, consider the word invalid
    }
}

function getCounts(word) {
    const counts = {};
    for (const letter of word) {
        counts[letter] = counts[letter] ? counts[letter] + 1 : 1;
    }
    return counts;
}

function isRowFilled(faceIndex, row) {
    for (let j = 0; j < gridSize; j++) {
        if (!guessPositions[faceIndex][row][j].filled) {
            return false;
        }
    }
    return true;
}

function allFacesGuessedForCurrentRow() {
    for (let i = 0; i < 4; i++) {
        if (!completedFaces[i] && currentGuesses[i] <= getMaxGuessRow()) {
            return false;
        }
    }
    return true;
}

function incrementGuessRow() {
    for (let i = 0; i < 4; i++) {
        if (!completedFaces[i]) {
            currentGuesses[i]++;
        }
    }
}

function getMaxGuessRow() {
    let maxRow = 0;
    for (let i = 0; i < 4; i++) {
        maxRow = Math.max(maxRow, currentGuesses[i]);
    }
    return maxRow;
}

function updateBoxColor(faceIndex, i, j, status) {
    const { box } = cube[faceIndex][i][j];
    box.material[4] = faceMaterials[status].clone(); // Only update the front face
    box.material[4].opacity = 1; // Ensure the face is visible when updating color
}

function updateCornerBoxColor(faceIndex, row, col, status) {
    if (col === 0) {
        const leftFaceIndex = (faceIndex + 3) % 4; // Face to the left
        const leftFaceRow = row;
        const leftFaceCol = 4;
        const { box } = cube[leftFaceIndex][leftFaceRow][leftFaceCol];
        box.material[4] = faceMaterials[status].clone(); // Only update the front face
        box.material[4].opacity = 1; // Ensure the face is visible when updating color
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        box.material[4] = faceMaterials[status].clone(); // Only update the front face
        box.material[4].opacity = 1; // Ensure the face is visible when updating color
    }
}

function checkWinCondition() {
    return completedFaces.every(face => face);
}

function checkLossCondition() {
    return currentGuesses.some(guesses => guesses >= maxGuesses);
}

function getCurrentFaceIndex() {
    const rotation = controls.getAzimuthalAngle();
    const index = Math.round(rotation / (Math.PI / 2)) % 4;
    return (index + 4) % 4; // Ensure positive face index
}


function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
