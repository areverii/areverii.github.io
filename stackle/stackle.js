import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let words = ["STACK", "KITES", "SOURS", "SPURS"];
const grid_size = 5;
const max_guesses = 5;
const cube_size = 5;
const cube = Array.from({ length: 4 }, () => Array.from({ length: grid_size }, () => Array(grid_size).fill(null)));
const guess_positions = Array.from({ length: 4 }, () => Array.from({ length: grid_size }, () => Array(grid_size).fill({ filled: false, locked: false })));
const completed_faces = Array(4).fill(false);
const current_guesses = Array(4).fill(0);

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

function init() {
    scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '50%';
    renderer.domElement.style.left = '50%';
    renderer.domElement.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = 2 * Math.PI / 3;

    camera.position.set(0, 0, 10);
    controls.update();

    document.getElementById('restart-button').addEventListener('click', restart_game);
    document.getElementById('start-button').addEventListener('click', start_game);
    document.getElementById('close-welcome-button').addEventListener('click', close_welcome_popup);
    document.getElementById('close-rules-button').addEventListener('click', close_rules_popup);
    document.getElementById('help-icon').addEventListener('click', show_rules_popup);

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', on_key_down, false);

    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            words = choose_words(data);
            console.log('Chosen words:', words);
            create_cube();
            show_welcome_popup();
        });

    document.querySelectorAll('.keyboard-button').forEach(button => {
        button.addEventListener('click', () => on_key_click(button.textContent));
    });
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

const choose_words = (word_list) => {
    word_list = word_list.filter(word => word.length === 5);

    while (true) {
        const chosen_words = [];
        const start_word = word_list[Math.floor(Math.random() * word_list.length)];
        chosen_words.push(start_word);

        let current_word = start_word;

        for (let i = 0; i < 3; i++) {
            const next_word = word_list.find(word =>
                word.startsWith(current_word[current_word.length - 1]) &&
                !chosen_words.includes(word)
            );

            if (!next_word) break;

            chosen_words.push(next_word);
            current_word = next_word;
        }

        if (chosen_words.length === 4 && chosen_words[3].endsWith(chosen_words[0][0])) {
            return chosen_words;
        }
    }
}

function create_cube() {
    const face_transforms = [
        { position: [0, 0, cube_size / 2 - 0.5], rotation: [0, 0, 0] },
        { position: [cube_size / 2 - 0.5, 0, 0], rotation: [0, Math.PI / 2, 0] },
        { position: [0, 0, -cube_size / 2 + 0.5], rotation: [0, Math.PI, 0] },
        { position: [-cube_size / 2 + 0.5, 0, 0], rotation: [0, -Math.PI / 2, 0] }
    ];

    ['front', 'right', 'back', 'left'].forEach((face, face_index) => {
        const face_group = new THREE.Group();
        face_group.position.set(...face_transforms[face_index].position);
        face_group.rotation.set(...face_transforms[face_index].rotation);
        for (let i = 0; i < grid_size; i++) {
            for (let j = 0; j < grid_size; j++) {
                const box = create_box();
                box.position.set(j - 2, i - 2, 0);
                face_group.add(box);
                cube[face_index][i][j] = { box, text: create_text_mesh(""), status: 'default' };
                cube[face_index][i][j].text.position.set(j - 2, i - 2, 0.55);
                cube[face_index][i][j].text.renderOrder = 1;
                face_group.add(cube[face_index][i][j].text);

                if (i === 0) {
                    box.material.opacity = 1;
                }
            }
        }
        scene.add(face_group);
        cube[face_index].group = face_group;
    });
}

function create_box() {
    const texture_loader = new THREE.TextureLoader();
    const hollow_square_texture = texture_loader.load('absent_square.png');
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ map: hollow_square_texture, transparent: true, opacity: 0 });
    return new THREE.Mesh(geometry, material);
}

function create_text_mesh(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.font = '96px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.userData = { text };
    return mesh;
}

function update_text_mesh(mesh, text) {
    const canvas = mesh.material.map.image;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    mesh.material.map.needsUpdate = true;
    mesh.userData.text = text;
    mesh.material.opacity = 1;
}

function on_key_down(event) {
    if (window.innerWidth > 768) {
        const current_face_index = get_current_face_index();
        if (completed_faces[current_face_index]) return;

        if (event.key >= 'a' && event.key <= 'z') {
            place_letter(event.key.toUpperCase());
        } else if (event.key === 'Backspace') {
            remove_letter();
        } else if (event.key === 'Enter') {
            check_guess();
        }
    }
}

function on_key_click(key) {
    if (window.innerWidth <= 768) {
        if (key === 'ENTER') {
            check_guess();
        } else if (key === '←') {
            remove_letter();
        } else {
            place_letter(key);
        }
    }
}

function place_letter(letter) {
    const current_face_index = get_current_face_index();
    const guess_row = current_guesses[current_face_index];
    for (let j = 0; j < grid_size; j++) {
        if (!guess_positions[current_face_index][guess_row][j].filled) {
            const { text, box } = cube[current_face_index][guess_row][j];
            update_text_mesh(text, letter);
            guess_positions[current_face_index][guess_row][j] = { filled: true, locked: false };
            update_shared_corners(current_face_index, guess_row, j, letter);
            update_shared_corner_visibility(current_face_index, guess_row, j, true);
            break;
        }
    }
}

function remove_letter() {
    const current_face_index = get_current_face_index();
    const guess_row = current_guesses[current_face_index];
    for (let j = grid_size - 1; j >= 0; j--) {
        if (guess_positions[current_face_index][guess_row][j].filled && !guess_positions[current_face_index][guess_row][j].locked) {
            const { text } = cube[current_face_index][guess_row][j];
            update_text_mesh(text, "");
            guess_positions[current_face_index][guess_row][j] = { filled: false, locked: false };
            update_shared_corners(current_face_index, guess_row, j, "");
            update_shared_corner_visibility(current_face_index, guess_row, j, false);
            break;
        }
    }
}

function update_shared_corners(face_index, row, col, letter) {
    if (col === 0) {
        const left_face_index = (face_index + 3) % 4;
        const left_face_row = row;
        const left_face_col = 4;
        const { text } = cube[left_face_index][left_face_row][left_face_col];
        update_text_mesh(text, letter);
        guess_positions[left_face_index][left_face_row][left_face_col] = letter ? { filled: true, locked: true } : { filled: false, locked: false };
    } else if (col === 4) {
        const right_face_index = (face_index + 1) % 4;
        const right_face_row = row;
        const right_face_col = 0;
        const { text } = cube[right_face_index][right_face_row][right_face_col];
        update_text_mesh(text, letter);
        guess_positions[right_face_index][right_face_row][right_face_col] = letter ? { filled: true, locked: true } : { filled: false, locked: false };
    }
}

function update_shared_corner_visibility(face_index, row, col, visible) {
    if (col === 0) {
        const left_face_index = (face_index + 3) % 4;
        const left_face_row = row;
        const left_face_col = 4;
        const { box } = cube[left_face_index][left_face_row][left_face_col];
        box.material.opacity = visible ? 1 : 0;
    } else if (col === 4) {
        const right_face_index = (face_index + 1) % 4;
        const right_face_row = row;
        const right_face_col = 0;
        const { box } = cube[right_face_index][right_face_row][right_face_col];
        box.material.opacity = visible ? 1 : 0;
    }
}

async function check_guess() {
    const current_face_index = get_current_face_index();
    const guess_row = current_guesses[current_face_index];

    if (!is_row_filled(current_face_index, guess_row)) {
        return;
    }

    const guess = [];
    for (let j = 0; j < grid_size; j++) {
        guess.push(cube[current_face_index][guess_row][j].text.userData.text);
    }

    const is_valid = await is_valid_word(guess.join('').toLowerCase());
    if (!is_valid) {
        show_notification('Not in word list');
        return;
    }

    const word = words[current_face_index];
    console.log("checking guess", guess.join(''), "against", word);
    const word_counts = get_counts(word);
    const guess_counts = get_counts(guess.join(''));

    for (let j = 0; j < grid_size; j++) {
        const letter = guess[j];
        if (letter.toLowerCase() === word[j]) {
            update_box_color(current_face_index, guess_row, j, 'correct');
            update_corner_box_color(current_face_index, guess_row, j, 'correct');
            cube[current_face_index][guess_row][j].status = 'correct';
            word_counts[letter.toLowerCase()]--;
            guess_counts[letter.toLowerCase()]--;
        }
    }

    for (let j = 0; j < grid_size; j++) {
        const letter = guess[j];
        if (letter.toLowerCase() !== word[j]) {
            if (word_counts[letter.toLowerCase()] > 0) {
                update_box_color(current_face_index, guess_row, j, 'present');
                update_corner_box_color(current_face_index, guess_row, j, 'present');
                cube[current_face_index][guess_row][j].status = 'present';
                word_counts[letter.toLowerCase()]--;
            } else {
                update_box_color(current_face_index, guess_row, j, 'absent');
                update_corner_box_color(current_face_index, guess_row, j, 'absent');
                cube[current_face_index][guess_row][j].status = 'absent';
            }
        }
    }

    for (let j = 0; j < grid_size; j++) {
        if (cube[current_face_index][guess_row][j].status === 'absent') {
            const letter = guess[j];
            for (let k = 0; k < 4; k++) {
                if (k !== current_face_index && words[k].includes(letter.toLowerCase())) {
                    update_box_color(current_face_index, guess_row, j, 'other_word');
                    update_corner_box_color(current_face_index, guess_row, j, 'other_word');
                    cube[current_face_index][guess_row][j].status = 'other_word';
                    break;
                }
            }
        }
    }

    if (guess.join('').toLowerCase() === word) {
        completed_faces[current_face_index] = true;
    }
    current_guesses[current_face_index]++;

    for (let j = 0; j < grid_size; j++) {
        guess_positions[current_face_index][guess_row][j].locked = true;
    }

    if (check_loss_condition()) {
        show_endgame_popup('You lose! The words were:', words.map(word => word.toUpperCase()));
        return;
    }

    if (check_win_condition()) {
        show_endgame_popup('Congratulations! You win!', []);
        return;
    }

    if (current_guesses[current_face_index] < max_guesses) {
        const next_guess_row = current_guesses[current_face_index];
        for (let j = 0; j < grid_size; j++) {
            cube[current_face_index][next_guess_row][j].box.material.opacity = 1;
        }
    }

    if (all_faces_guessed_for_current_row()) {
        increment_guess_row();
    }
}

async function is_valid_word(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = await response.json();
        return !data.title;
    } catch (error) {
        console.error('Error validating word:', error);
        return false;
    }
}

function get_counts(word) {
    const counts = {};
    word.split('').forEach(letter => {
        counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
}

function is_row_filled(face_index, row) {
    for (let j = 0; j < grid_size; j++) {
        if (!guess_positions[face_index][row][j].filled) {
            return false;
        }
    }
    return true;
}

function all_faces_guessed_for_current_row() {
    for (let i = 0; i < 4; i++) {
        if (!completed_faces[i] && current_guesses[i] <= get_max_guess_row()) {
            return false;
        }
    }
    return true;
}

function increment_guess_row() {
    for (let i = 0; i < 4; i++) {
        if (!completed_faces[i]) {
            current_guesses[i]++;
        }
    }
}

function get_max_guess_row() {
    let max_row = 0;
    for (let i = 0; i < 4; i++) {
        max_row = Math.max(max_row, current_guesses[i]);
    }
    return max_row;
}

function update_box_color(face_index, i, j, status) {
    const { box } = cube[face_index][i][j];
    console.log("updating box color", face_index, i, j, status);
    box.material.map = new THREE.TextureLoader().load(`${status}_square.png`);
    box.material.opacity = 1;
}

function update_corner_box_color(face_index, row, col, status) {
    if (col === 0) {
        const left_face_index = (face_index + 3) % 4;
        const left_face_row = row;
        const left_face_col = 4;
        const { box } = cube[left_face_index][left_face_row][left_face_col];
        box.material.map = new THREE.TextureLoader().load(`${status}_square.png`);
        box.material.opacity = 1;
    } else if (col === 4) {
        const right_face_index = (face_index + 1) % 4;
        const right_face_row = row;
        const right_face_col = 0;
        const { box } = cube[right_face_index][right_face_row][right_face_col];
        box.material.map = new THREE.TextureLoader().load(`${status}_square.png`);
        box.material.opacity = 1;
    }
}

function check_win_condition() {
    return completed_faces.every(face => face);
}

function check_loss_condition() {
    return current_guesses.some(guesses => guesses >= max_guesses);
}

function get_current_face_index() {
    const rotation = controls.getAzimuthalAngle();
    const index = Math.round(rotation / (Math.PI / 2)) % 4;
    return (index + 4) % 4;
}

function show_notification(message) {
    const existing_notification = document.querySelector('.notification');
    if (existing_notification) {
        existing_notification.remove();
    }

    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, 3000);
}

function show_endgame_popup(message, word_list) {
    const popup = document.getElementById('endgame-popup');
    const message_element = document.getElementById('endgame-message');
    const word_list_element = document.getElementById('word-list');

    message_element.textContent = message;
    word_list_element.textContent = word_list.length ? `${word_list.join(', ')}` : '';

    popup.style.display = 'block';
}

function show_welcome_popup() {
    if (!get_cookie('seen_welcome')) {
        const popup = document.getElementById('welcome-popup');
        popup.style.display = 'block';
    }
}

function close_welcome_popup() {
    const popup = document.getElementById('welcome-popup');
    popup.style.display = 'none';
}

function show_rules_popup() {
    const popup = document.getElementById('rules-popup');
    popup.style.display = 'block';
}

function close_rules_popup() {
    const popup = document.getElementById('rules-popup');
    popup.style.display = 'none';
}

function start_game() {
    const popup = document.getElementById('welcome-popup');
    popup.style.display = 'none';
    set_cookie('seen_welcome', 'true', 365);
}

function restart_game() {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < grid_size; j++) {
            for (let k = 0; k < grid_size; k++) {
                const { text, box } = cube[i][j][k];
                update_text_mesh(text, "");
                box.material.map = null;
                box.material.opacity = 0;
                guess_positions[i][j][k] = { filled: false, locked: false };
            }
        }
        completed_faces[i] = false;
        current_guesses[i] = 0;
    }

    const popup = document.getElementById('endgame-popup');
    popup.style.display = 'none';

    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            words = choose_words(data);
            console.log('Chosen words:', words);
            create_cube();
        });
}

function set_cookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function get_cookie(name) {
    const name_eq = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(name_eq) === 0) return c.substring(name_eq.length, c.length);
    }
    return null;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
