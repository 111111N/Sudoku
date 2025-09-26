// =========================================================
// === Core Constants and DOM Elements ===
// =========================================================

const SIZE = 9; 
const game = document.getElementById("game");
const gridEl = document.getElementById("sudoku-grid"); 

const scoreEl = document.getElementById("score"); 
const bestEl = document.getElementById("best-score"); 
const levelEl = document.getElementById("level"); 
const newGameBtn = document.getElementById("newgame");
const soundToggle = document.getElementById("sound-toggle");
const virtualKeyboard = document.getElementById("virtual-keyboard"); 

// Overlay
let startOverlay = document.getElementById('start-overlay'); 

// Check if overlay exists, if not, create it (for robustness)
if (!startOverlay) {
    startOverlay = document.createElement('div');
    startOverlay.id = 'start-overlay';
    startOverlay.innerHTML = `
        <div id="start-card">
            <h2 id="start-title">SUDOKU — CyberPunk</h2>
            <p id="start-score" style="margin-top: 10px; font-size: 20px; font-weight: bold; color: var(--color-gold);"></p>
            <p id="start-message"></p>
        </div>
    `;
    game.appendChild(startOverlay);
}

const startTitle = startOverlay.querySelector('#start-title');
const startMessage = startOverlay.querySelector('#start-message');
const startScore = startOverlay.querySelector('#start-score');

// === Sudoku State ===
let currentBoard = []; 
let solutionBoard = []; 
let errors = 0;
let difficulty = 'Medium';
let gameStartTime = 0;
let timerInterval = null;
let selectedCell = null; // Хранит элемент div.sudoku-cell
let soundOn = (localStorage.getItem("snake_sound") || "1") === "1"; 

// =========================================================
// === Sudoku Logic (Generator/Solver) ===
// =========================================================

function createEmptyBoard() {
    return Array(SIZE).fill(0).map(() => Array(SIZE).fill(0));
}

function solve(board) {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === 0) {
                const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                shuffle(numbers); 
                
                for (const n of numbers) {
                    if (isValidPlacement(board, r, c, n)) {
                        board[r][c] = n;
                        if (solve(board)) {
                            return true;
                        }
                        board[r][c] = 0; // Backtrack
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function isValidPlacement(board, r, c, n) {
    for (let i = 0; i < SIZE; i++) {
        if (board[r][i] === n || board[i][c] === n) return false;
    }
    
    const boxRowStart = Math.floor(r / 3) * 3;
    const boxColStart = Math.floor(c / 3) * 3;
    for (let row = boxRowStart; row < boxRowStart + 3; row++) {
        for (let col = boxColStart; col < boxColStart + 3; col++) {
            if (board[row][col] === n) return false;
        }
    }
    return true;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function generateSolvedBoard() {
    const board = createEmptyBoard();
    solve(board);
    return board;
}

function generatePuzzle(solvedBoard, level) {
    let cellsToRemove;
    switch (level.toLowerCase()) {
        case 'easy': cellsToRemove = 35; break; 
        case 'medium': cellsToRemove = 45; break; 
        case 'hard': cellsToRemove = 55; break; 
        default: cellsToRemove = 45;
    }

    let puzzle = solvedBoard.map(row => [...row]); 
    const allCells = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            allCells.push([r, c]);
        }
    }
    shuffle(allCells);

    let removedCount = 0;
    for (const [r, c] of allCells) {
        if (removedCount >= cellsToRemove) break;
        puzzle[r][c] = 0; 
        removedCount++;
    }

    return puzzle;
}

// =========================================================
// === Rendering ===
// =========================================================
function renderBoard() {
    gridEl.innerHTML = ''; 
    gridEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${SIZE}, 1fr)`;

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement("div");
            cell.className = "sudoku-cell";
            cell.dataset.row = r + 1; 
            cell.dataset.col = c + 1;

            const value = currentBoard[r][c];
            
            if (value !== 0) {
                cell.textContent = value;
                cell.classList.add('fixed-value');
            } else {
                const input = document.createElement("input");
                input.type = 'text';
                input.maxLength = 1;
                input.pattern = '[1-9]';
                input.value = '';
                input.dataset.r = r; 
                input.dataset.c = c;
                input.classList.add('input-value');
                cell.appendChild(input);

                input.addEventListener('input', handleInput);
                input.addEventListener('focus', handleFocus);
                input.addEventListener('blur', handleBlur);
                cell.addEventListener('click', () => { 
                    input.focus();
                }); 
            }
            
            gridEl.appendChild(cell);
        }
    }
    // *** ИСПРАВЛЕНИЕ #1: Удаляем синхронный вызов recalcLayout(), 
    // чтобы избежать пересчета макета до стабилизации DOM. ***
    // recalcLayout(); 
}

function recalcLayout() {
    const firstCell = gridEl.querySelector('.sudoku-cell');
    if (firstCell) {
        // *** ИСПРАВЛЕНИЕ #3: Используем offsetWidth, так как ширина чаще более стабильна
        // для квадратных ячеек в адаптивном дизайне. ***
        const cellSize = firstCell.offsetWidth; 
        const fontSize = Math.floor(cellSize * 0.45); 
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.style.fontSize = `${fontSize}px`;
            const input = cell.querySelector('input');
            if(input) {
                input.style.fontSize = `${fontSize}px`;
            }
        });
    }
}


// =========================================================
// === Input Handling & Validation ===
// =========================================================

function applyKeyValueToSelectedCell(key) {
    if (!selectedCell) return;
    
    const input = selectedCell.querySelector('input');
    if (!input) return;

    if (key === 'Delete' || key === 'Backspace') {
        input.value = ''; 
    } else if (/[1-9]/.test(key) && key.length === 1) {
        input.value = key; 
    } else {
        return; 
    }

    handleInput({ target: input });
    input.focus(); 
}

function handleInput(event) {
    const input = event.target;
    let val = input.value.replace(/[^1-9]/g, '');
    input.value = val;

    const r = parseInt(input.dataset.r);
    const c = parseInt(input.dataset.c);
    
    const num = val === '' ? 0 : parseInt(val);
    currentBoard[r][c] = num;
    
    updateErrors();

    if (val.length === 1) {
        checkWinCondition();
    }
}

function handleFocus(event) {
    const cell = event.target.closest('.sudoku-cell');
    if (!cell) return;
    
    selectedCell = cell; 
    highlightRelatedCells(cell);
}

function handleBlur(event) {
    clearHighlights();
}

function highlightRelatedCells(cell) {
    clearHighlights();
    const targetR = parseInt(cell.dataset.row); 
    const targetC = parseInt(cell.dataset.col); 

    const targetBlockR = Math.floor((targetR - 1) / 3);
    const targetBlockC = Math.floor((targetC - 1) / 3);

    gridEl.querySelectorAll('.sudoku-cell').forEach(el => {
        const cellR = parseInt(el.dataset.row); 
        const cellC = parseInt(el.dataset.col); 

        if (cellR === targetR && cellC === targetC) {
            el.classList.add('highlight-target');
            return;
        } 
        
        const currentBlockR = Math.floor((cellR - 1) / 3);
        const currentBlockC = Math.floor((cellC - 1) / 3);

        if (
            cellR === targetR || 
            cellC === targetC || 
            (currentBlockR === targetBlockR && currentBlockC === targetBlockC) 
        ) {
            el.classList.add('highlight-related');
        }
    });
}

function clearHighlights() {
    gridEl.querySelectorAll('.highlight-target, .highlight-related').forEach(el => {
        el.classList.remove('highlight-target', 'highlight-related');
    });
}


// =========================================================
// === Game State Management ===
// =========================================================
function updateErrors() {
    let currentErrors = 0;
    
    gridEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const val = currentBoard[r][c];
            if (val !== 0) {
                if (val !== solutionBoard[r][c]) {
                    currentErrors++;
                    const cellEl = gridEl.querySelector(`[data-row="${r+1}"][data-col="${c+1}"]`);
                    if (cellEl) cellEl.classList.add('error');
                }
            }
        }
    }
    
    errors = currentErrors;
    scoreEl.textContent = errors;
}

function checkWinCondition() {
    const allFilled = currentBoard.every(row => row.every(val => val !== 0));
    
    if (allFilled) {
        updateErrors(); 
        if (errors === 0) {
            gameOver(true); 
        } 
    }
}

function updateHUD(timeElapsed = 0) {
    scoreEl.textContent = errors;
    levelEl.textContent = difficulty;
    
    const timeFormatted = formatTime(timeElapsed);
    bestEl.textContent = timeFormatted; 
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function runTimer() {
    if (timerInterval) clearInterval(timerInterval);
    gameStartTime = Date.now();
    updateHUD(0);
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        updateHUD(elapsed);
    }, 1000);
}

function initGame() {
    // 1. Generate new puzzle
    solutionBoard = generateSolvedBoard();
    currentBoard = generatePuzzle(solutionBoard, difficulty); 
    
    // 2. Reset state
    errors = 0;
    selectedCell = null; 
    
    // 3. Render (вставляет элементы, но не устанавливает размер шрифта)
    renderBoard();
    
    // 4. Update HUD and start timer
    updateHUD(0);
    
    // 5. Hide overlay
    hideStartOverlay();
}

function startGame() {
    initGame();
    runTimer();
    // *** ИСПРАВЛЕНИЕ #2: Вызываем recalcLayout сразу после запуска игры 
    // и скрытия оверлея, чтобы обеспечить стабильность макета. ***
    recalcLayout(); 
}
function gameOver(win) {
    if (timerInterval) clearInterval(timerInterval);
    
    const finalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    const bestTimeStr = localStorage.getItem("sudoku_best_time_sec");
    let isNewBest = false;
    
    if (win && (!bestTimeStr || finalTime < parseInt(bestTimeStr))) {
        localStorage.setItem("sudoku_best_time_sec", finalTime);
        localStorage.setItem("sudoku_best_time", formatTime(finalTime));
        isNewBest = true;
    }

    showStartOverlay(true, win, finalTime, isNewBest);
}

function showStartOverlay(isGameOver = false, win = false, finalTime = 0, isNewBest = false) {
    startOverlay.classList.add('visible');
    game.style.pointerEvents = "none";
    
    if (isGameOver) {
        startScore.style.display = 'block';
        
        if (win) {
            startTitle.textContent = "ПОБЕДА";
            startOverlay.classList.add('gameover'); 
            startTitle.style.color = 'var(--color-gold)';
            startScore.textContent = `Время: ${formatTime(finalTime)}`;
            startMessage.textContent = isNewBest ? 'НОВЫЙ ЛУЧШИЙ РЕЗУЛЬТАТ! Нажмите Enter/клик, чтобы начать заново.' : 'Отлично! Нажмите Enter/клик, чтобы начать заново.';
        } else {
            startTitle.textContent = "ИГРА ЗАВЕРШЕНА";
            startOverlay.classList.add('gameover');
            startTitle.style.color = 'var(--color-gold)';
            startScore.textContent = `Ошибок: ${errors}`;
            startMessage.textContent = 'Нажмите Enter/клик, чтобы начать заново.';
        }
    } else {
        startTitle.textContent = "SUDOKU — CyberPunk";
        startTitle.style.color = 'var(--color-magenta)';
        startScore.style.display = 'none';
        startMessage.textContent = isMobile ? 'Нажмите, чтобы начать' : 'Нажмите Enter, чтобы начать';
        startOverlay.classList.remove('gameover');
    }
}

function hideStartOverlay() {
    startOverlay.classList.remove('visible');
    game.style.pointerEvents = "";
}


// =========================================================
// === Controls & Event Listeners ===
// =========================================================
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// === 1. Обработка нажатий на ФИЗИЧЕСКОЙ клавиатуре ===
document.addEventListener("keydown", (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        return; 
    }
    
    if (e.key === 'Enter') {
        if (startOverlay.classList.contains('visible')) {
            e.preventDefault();
            startGame();
            return;
        }
    }
    
    if (selectedCell && (/[1-9]/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        applyKeyValueToSelectedCell(e.key);
    }
});

// === 2. Обработка нажатий на ВИРТУАЛЬНОЙ клавиатуре ===
const virtualKeyboardEl = document.getElementById("virtual-keyboard");
if (virtualKeyboardEl) {
    virtualKeyboardEl.addEventListener('click', (e) => {
        const button = e.target.closest('.key-btn');
        if (!button) return;
        
        e.preventDefault(); 
        
        const key = button.dataset.key; 
        applyKeyValueToSelectedCell(key);
    });
}

startOverlay.addEventListener("click", () => {
    if (startOverlay.classList.contains('visible')) {
        startGame();
    }
});

newGameBtn?.addEventListener("click", () => {
    if (timerInterval) clearInterval(timerInterval);
    showStartOverlay(); 
});

const soundOnSVG = `
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M5 9v6h4l5 5V4l-5 5H5z" stroke="#E455AE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17 9 A3 3 0 0 1 17 15" stroke="#E455AE" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg>`;
const soundOffSVG = `
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M5 9v6h4l5 5V4l-5 5H5z" stroke="#E455AE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
function updateSoundIcon() {
    if (soundOn) {
        soundToggle.innerHTML = soundOnSVG;
        soundToggle.setAttribute('aria-pressed', 'true');
    } else {
        soundToggle.innerHTML = soundOffSVG;
        soundToggle.setAttribute('aria-pressed', 'false');
    }
}

soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("snake_sound", soundOn ? "1" : "0");
    updateSoundIcon();
});


// Resize handlers
window.addEventListener("resize", () => setTimeout(recalcLayout, 50));

// Initialization on load
window.addEventListener('load', () => {
    document.getElementById("score-card").querySelector('.label').textContent = "Errors";
    document.getElementById("best-card").querySelector('.label').textContent = "Time";
    document.getElementById("level-card").querySelector('.label').textContent = "Difficulty";
    
    const bestTime = localStorage.getItem("sudoku_best_time") || "00:00";
    bestEl.textContent = bestTime;

    // Вызываем recalcLayout сразу, чтобы установить размер шрифта для первого запуска (если сетка пустая)
    // А если сетка пустая, то он ничего не сделает, но это нормально.
    // Основной вызов произойдет при renderBoard с задержкой 50мс.
    recalcLayout(); 
    showStartOverlay(); 
    updateSoundIcon();
});