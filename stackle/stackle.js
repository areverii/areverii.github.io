import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let words = ["STACK", "KITES", "SOURS", "SPURS"]; // Placeholder, will be set dynamically
const gridSize = 5;
const maxGuesses = 5;
const cubeSize = 5;
const cube = Array.from({ length: 4 }, () => Array.from({ length: gridSize }, () => Array(gridSize).fill(null))); // 3D array for the cube
const guessPositions = Array.from({ length: 4 }, () => Array.from({ length: gridSize }, () => Array(gridSize).fill({ filled: false, locked: false }))); // Track filled and locked positions for each row
const completedFaces = Array(4).fill(false); // Track completed faces
const currentGuesses = Array(4).fill(0); // Track current guess row for each face

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

    document.getElementById('restart-button').addEventListener('click', restartGame);
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('close-rules-button').addEventListener('click', closeRulesPopup);
    document.getElementById('help-icon').addEventListener('click', showRulesPopup);

    window.addEventListener('keydown', onKeyDown, false);

    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            words = chooseWords(data);
            console.log('Chosen words:', words); // Debugging
            createCube();
            showWelcomePopup();
        });
}

function chooseWords(wordList) {
    // Filter the word list to only include 5-letter words
    wordList = wordList.filter(word => word.length === 5);

    while (true) {
        const chosenWords = [];
        const startWord = wordList[Math.floor(Math.random() * wordList.length)];
        chosenWords.push(startWord);

        let currentWord = startWord;

        for (let i = 0; i < 3; i++) {
            const nextWord = wordList.find(word =>
                word.startsWith(currentWord[currentWord.length - 1]) &&
                !chosenWords.includes(word)
            );

            if (!nextWord) break;

            chosenWords.push(nextWord);
            currentWord = nextWord;
        }

        if (chosenWords.length === 4 && chosenWords[3].endsWith(chosenWords[0][0])) {
            return chosenWords;
        }
    }
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
                cube[faceIndex][i][j] = { box, text: createTextMesh(""), status: 'default' };
                cube[faceIndex][i][j].text.position.set(j - 2, i - 2, 0.55); // Slightly offset text
                cube[faceIndex][i][j].text.renderOrder = 1; // Ensure text is rendered above the box
                faceGroup.add(cube[faceIndex][i][j].text);

                if (i === 0) { // Initialize the first guess row with the absent_square sprite
                    box.material.opacity = 1;
                }
            }
        }
        scene.add(faceGroup);
        cube[faceIndex].group = faceGroup;
    });
}


function createBox() {
    const textureLoader = new THREE.TextureLoader();
    const hollowSquareTexture = textureLoader.load('absent_square.png');
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ map: hollowSquareTexture, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}


function createTextMesh(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.font = '96px Arial';
    context.fillStyle = 'white'; // White text color
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.userData = { text };
    return mesh;
}

function updateTextMesh(mesh, text) {
    const canvas = mesh.material.map.image;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white'; // White text color
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
            const { text } = cube[currentFaceIndex][guessRow][j];
            updateTextMesh(text, "");
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
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { text, box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        updateTextMesh(text, letter);
        guessPositions[rightFaceIndex][rightFaceRow][rightFaceCol] = letter ? { filled: true, locked: true } : { filled: false, locked: false };
    }
}

function updateSharedCornerVisibility(faceIndex, row, col, visible) {
    if (col === 0) {
        const leftFaceIndex = (faceIndex + 3) % 4; // Face to the left
        const leftFaceRow = row;
        const leftFaceCol = 4;
        const { box } = cube[leftFaceIndex][leftFaceRow][leftFaceCol];
        box.material.opacity = visible ? 1 : 0; // Update the hollow square visibility
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        box.material.opacity = visible ? 1 : 0; // Update the hollow square visibility
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

    const isValid = await isValidWord(guess.join('').toLowerCase()); // Convert guess to lowercase
    if (!isValid) {
        showNotification('Not in word list');
        return;
    }

    const word = words[currentFaceIndex];
    console.log("checking guess", guess.join(''), "against", word); // Debugging
    const wordCounts = getCounts(word);
    const guessCounts = getCounts(guess.join(''));

    // First pass for correct letters
    for (let j = 0; j < gridSize; j++) {
        const letter = guess[j];
        if (letter.toLowerCase() === word[j]) {
            updateBoxColor(currentFaceIndex, guessRow, j, 'correct');
            updateCornerBoxColor(currentFaceIndex, guessRow, j, 'correct');
            cube[currentFaceIndex][guessRow][j].status = 'correct';
            wordCounts[letter.toLowerCase()]--;
            guessCounts[letter.toLowerCase()]--;
        }
    }

    // Second pass for present and absent letters
    for (let j = 0; j < gridSize; j++) {
        const letter = guess[j];
        if (letter.toLowerCase() !== word[j]) {
            if (wordCounts[letter.toLowerCase()] > 0) {
                updateBoxColor(currentFaceIndex, guessRow, j, 'present');
                updateCornerBoxColor(currentFaceIndex, guessRow, j, 'present');
                cube[currentFaceIndex][guessRow][j].status = 'present';
                wordCounts[letter.toLowerCase()]--;
            } else {
                updateBoxColor(currentFaceIndex, guessRow, j, 'absent');
                updateCornerBoxColor(currentFaceIndex, guessRow, j, 'absent');
                cube[currentFaceIndex][guessRow][j].status = 'absent';
            }
        }
    }

    // Check for letters in other words
    for (let j = 0; j < gridSize; j++) {
        if (cube[currentFaceIndex][guessRow][j].status === 'absent') {
            const letter = guess[j];
            for (let k = 0; k < 4; k++) {
                if (k !== currentFaceIndex && words[k].includes(letter.toLowerCase())) {
                    updateBoxColor(currentFaceIndex, guessRow, j, 'otherWord');
                    updateCornerBoxColor(currentFaceIndex, guessRow, j, 'otherWord');
                    cube[currentFaceIndex][guessRow][j].status = 'otherWord';
                    break;
                }
            }
        }
    }

    if (guess.join('').toLowerCase() === word) {
        completedFaces[currentFaceIndex] = true;
    }
    currentGuesses[currentFaceIndex]++;

    // Lock the letters in the guess
    for (let j = 0; j < gridSize; j++) {
        guessPositions[currentFaceIndex][guessRow][j].locked = true;
    }

    // Check for win/loss conditions
    if (checkLossCondition()) {
        showEndgamePopup('You lose! The words were:', words.map(word => word.toUpperCase()));
        return;
    }

    if (checkWinCondition()) {
        showEndgamePopup('Congratulations! You win!', []);
        return;
    }

    // Update the next guess row to show the absent_square sprite
    if (currentGuesses[currentFaceIndex] < maxGuesses) {
        const nextGuessRow = currentGuesses[currentFaceIndex];
        for (let j = 0; j < gridSize; j++) {
            cube[currentFaceIndex][nextGuessRow][j].box.material.opacity = 1;
        }
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
    console.log("updating box color", faceIndex, i, j, status); // Debugging
    box.material.map = new THREE.TextureLoader().load(`${status}_square.png`); // Load the appropriate colored square image
    box.material.opacity = 1; // Ensure the hollow square is visible
}

function updateCornerBoxColor(faceIndex, row, col, status) {
    if (col === 0) {
        const leftFaceIndex = (faceIndex + 3) % 4; // Face to the left
        const leftFaceRow = row;
        const leftFaceCol = 4;
        const { box } = cube[leftFaceIndex][leftFaceRow][leftFaceCol];
        box.material.map = new THREE.TextureLoader().load(`${status}_square.png`); // Load the appropriate colored square image
        box.material.opacity = 1; // Ensure the hollow square is visible
    } else if (col === 4) {
        const rightFaceIndex = (faceIndex + 1) % 4; // Face to the right
        const rightFaceRow = row;
        const rightFaceCol = 0;
        const { box } = cube[rightFaceIndex][rightFaceRow][rightFaceCol];
        box.material.map = new THREE.TextureLoader().load(`${status}_square.png`); // Load the appropriate colored square image
        box.material.opacity = 1; // Ensure the hollow square is visible
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

function showNotification(message) {
    // Remove any existing notifications first
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    container.appendChild(notification);

    // Show the notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Hide and remove the notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, 3000);
}

function showEndgamePopup(message, wordList) {
    const popup = document.getElementById('endgame-popup');
    const messageElement = document.getElementById('endgame-message');
    const wordListElement = document.getElementById('word-list');

    messageElement.textContent = message;
    wordListElement.textContent = wordList.length ? `${wordList.join(', ')}` : '';

    popup.style.display = 'block';
}

function showWelcomePopup() {
    if (!getCookie('seenWelcome')) {
        const popup = document.getElementById('welcome-popup');
        popup.style.display = 'block';
    }
}

function showRulesPopup() {
    const popup = document.getElementById('rules-popup');
    popup.style.display = 'block';
}

function closeRulesPopup() {
    const popup = document.getElementById('rules-popup');
    popup.style.display = 'none';
}

function startGame() {
    const popup = document.getElementById('welcome-popup');
    popup.style.display = 'none';
    setCookie('seenWelcome', 'true', 365);
}

function restartGame() {
    // Reset game state
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < gridSize; j++) {
            for (let k = 0; k < gridSize; k++) {
                const { text, box } = cube[i][j][k];
                updateTextMesh(text, "");
                box.material.map = null; // Reset the hollow square
                box.material.opacity = 0; // Make the hollow square invisible
                guessPositions[i][j][k] = { filled: false, locked: false };
            }
        }
        completedFaces[i] = false;
        currentGuesses[i] = 0;
    }

    // Hide the endgame popup
    const popup = document.getElementById('endgame-popup');
    popup.style.display = 'none';

    // Re-fetch words and set up the game again
    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            words = chooseWords(data);
            console.log('Chosen words:', words); // Debugging
            createCube();
        });
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
