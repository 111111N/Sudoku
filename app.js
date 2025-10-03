// =========================================================
// === Core Constants and DOM Elements ===
// =========================================================

const SIZE = 9; 
const game = document.getElementById("game");
const gridEl = document.getElementById("sudoku-grid"); 
const gameWrapEl = document.getElementById("game-wrap"); 
const keyboardWrapEl = document.getElementById("keyboard-wrap"); 
const containerEl = document.getElementById("container"); 

const scoreEl = document.getElementById("score"); 
const bestEl = document.getElementById("best-score"); 
const newGameBtn = document.getElementById("newgame");
const soundToggle = document.getElementById("sound-toggle");
const virtualKeyboard = document.getElementById("virtual-keyboard"); 

const hintBtn = document.getElementById("hint-btn"); 
const hintCounterEl = document.getElementById("hint-counter"); 
const notesToggleBtn = document.getElementById("notes-toggle"); 

// Overlay
let startOverlay = document.getElementById('start-overlay'); 

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
let initialBoard = []; 
let solutionBoard = []; 
let currentDisplayedErrors = 0; 
let totalErrors = 0; // Общее количество совершенных ошибок (НЕ сбрасывается при Undo)
let difficulty = 'Medium'; 
let gameStartTime = 0;
let timerInterval = null;
let selectedCell = null; 
let soundOn = (localStorage.getItem("snake_sound") || "1") === "1"; 

let hintsRemaining = 3; 
let isNotesMode = false; 
let notesBoard = []; 
let hintCells = new Set(); // Отслеживание ячеек, заполненных подсказкой

// History state (Undo)
let history = []; 
const MAX_HISTORY = 50; 


// =========================================================
// === Undo History Management ===
// =========================================================

function saveState() {
    const currentBoardCopy = currentBoard.map(row => [...row]);
    const notesBoardCopy = notesBoard.map(row => row.map(set => new Set(set)));

    history.push({ 
        board: currentBoardCopy, 
        notes: notesBoardCopy,
        totalErrors: totalErrors, // Сохраняется для статистики в истории
        hintsRemaining: hintsRemaining, 
        hintCells: new Set(hintCells)
    });

    if (history.length > MAX_HISTORY) {
        history.shift(); 
    }
}

function undo() {
    if (history.length <= 1) { 
        return;
    }
    
    // 1. Удаляем последнее состояние
    history.pop(); 
    
    // 2. Берем новое последнее состояние
    const previousState = history[history.length - 1]; 
    
    // Восстанавливаем доски и состояние
    currentBoard = previousState.board.map(row => [...row]);
    notesBoard = previousState.notes.map(row => row.map(set => new Set(set)));
    // totalErrors НЕ ВОССТАНАВЛИВАЕТСЯ, чтобы счетчик не уменьшался
    hintsRemaining = previousState.hintsRemaining; 
    hintCells = new Set(previousState.hintCells); 
    
    // Перерисовываем и обновляем состояние
    renderBoard();
    updateErrors();
    updateHintsUI();
    
    // Сбрасываем выделение
    selectedCell = null;
    clearHighlights();
    clearValueHighlights();
}

// =========================================================
// === Sudoku Logic (Generator/Solver) ===
// =========================================================
function createEmptyBoard() {
    return Array(SIZE).fill(0).map(() => Array(SIZE).fill(0));
}

function createEmptyNotesBoard() {
    return Array(SIZE).fill(0).map(() => Array(SIZE).fill(0).map(() => new Set()));
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

    const blockBorderColor = "rgba(0, 251, 255, 0.67)"; 
    
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement("div");
            cell.className = "sudoku-cell";
            cell.dataset.row = r + 1; 
            cell.dataset.col = c + 1;
            
            const isColBoundary = (c + 1) % 3 === 0 && c + 1 !== 9; 
            const isRowBoundary = (r + 1) % 3 === 0 && r + 1 !== 9; 
            if (isColBoundary) { cell.style.borderRight = `2px solid ${blockBorderColor}`; }
            if (isRowBoundary) { cell.style.borderBottom = `2px solid ${blockBorderColor}`; }

            const value = currentBoard[r][c];
            
            if (initialBoard[r][c] !== 0) {
                // Исходно заданные (неизменяемые)
                cell.textContent = initialBoard[r][c];
                cell.classList.add('fixed-value');
                cell.addEventListener('click', () => { 
                    handleFocus({ target: cell }); 
                }); 
            } else if (hintCells.has(`${r},${c}`)) { 
                // Заполнены с помощью подсказки - теперь они неотменяемые, как фиксированные, 
                // но с цветом, как у введенных пользователем
                cell.textContent = value;
                cell.classList.add('user-entered'); 
                cell.addEventListener('click', () => { 
                    handleFocus({ target: cell }); 
                }); 
            } else {
                const input = document.createElement("input");
                
               
                input.type = 'text'; 
                input.readOnly = true; 
                input.setAttribute('inputmode', 'none'); 
                
                // ==========================================
                
                input.maxLength = 1;
                input.pattern = '[1-9]';
                input.value = value === 0 ? '' : value; 
                input.dataset.r = r; 
                input.dataset.c = c;
                input.classList.add('input-value');
                cell.appendChild(input);

                // Notes container
                const notesContainer = document.createElement("div");
                notesContainer.className = "notes";
                notesContainer.dataset.r = r;
                notesContainer.dataset.c = c;
                for (let i = 1; i <= 9; i++) {
                    const noteSpan = document.createElement("span");
                    noteSpan.dataset.note = i;
                    notesContainer.appendChild(noteSpan);
                }
                cell.appendChild(notesContainer);
                
                updateNotesDisplay(r, c, notesContainer);
                
                input.addEventListener('input', (e) => {
                    const prevVal = currentBoard[r][c];
                    handleInput(e); 
                    const newVal = currentBoard[r][c];
                    if(prevVal !== newVal) {
                        saveState();
                    }
                });
                input.addEventListener('focus', handleFocus);
                input.addEventListener('blur', handleBlur);
                
                cell.addEventListener('click', () => { 
                    input.focus();
                }); 
            }
            
            gridEl.appendChild(cell);
        }
    }
    recalcLayout(); 
}

function updateNotesDisplay(r, c, notesContainer) {
    const notes = notesBoard[r][c];
    if (!notesContainer) {
        notesContainer = gridEl.querySelector(`.sudoku-cell .notes[data-r="${r}"][data-c="${c}"]`);
        if (!notesContainer) return;
    }
    
    notesContainer.querySelectorAll('span').forEach(span => {
        const noteValue = parseInt(span.dataset.note);
        if (notes.has(noteValue)) {
            span.textContent = noteValue;
        } else {
            span.textContent = '';
        }
    });
}


function recalcLayout() {
    const hudEl = document.getElementById("hud");
    const containerPadding = 18 * 2; 
    const hudHeight = hudEl ? hudEl.offsetHeight : 0; 
    const hudMarginBottom = 14; 
    
    const reservedVerticalSpace = hudHeight + hudMarginBottom + containerPadding; 
    
    const availableGameWrapHeight = window.innerHeight - reservedVerticalSpace;

    const keyboardHeight = keyboardWrapEl ? keyboardWrapEl.offsetHeight : 0; 
    
    const maxGameWidth = gameWrapEl ? gameWrapEl.clientWidth : 0; 

    const gridVerticalPadding = 14 * 2; 
    const availableGridHeight = availableGameWrapHeight - keyboardHeight - gridVerticalPadding; 
    
    const targetGridSize = Math.min(maxGameWidth, availableGridHeight);

    gridEl.style.width = `${targetGridSize}px`;
    gridEl.style.height = `${targetGridSize}px`;
    
    const cellSize = targetGridSize / SIZE; 
    const fontSize = Math.floor(cellSize * 0.55); 
    
    document.querySelectorAll('.sudoku-cell').forEach(cell => {
        cell.style.fontSize = `${fontSize}px`;
        const input = cell.querySelector('input');
        if(input) {
            input.style.fontSize = `${fontSize}px`;
        }
    });
}


// =========================================================
// === Highlighting Logic ===
// =========================================================

function clearValueHighlights() {
    gridEl.querySelectorAll('.highlight-value').forEach(el => {
        el.classList.remove('highlight-value');
    });
}

function highlightSameValues(value) {
    clearValueHighlights();
    const num = parseInt(value);
    if (isNaN(num) || num === 0) return;

    gridEl.querySelectorAll('.sudoku-cell').forEach((cell) => {
        const r = parseInt(cell.dataset.row) - 1; 
        const c = parseInt(cell.dataset.col) - 1; 
        
        if (currentBoard[r][c] === num) {
            cell.classList.add('highlight-value');
        }
    });
}

// =========================================================
// === Notes Auto-Cleanup Logic ===
// =========================================================

/**
 * Удаляет указанное число из заметок во всех ячейках того же ряда, столбца и блока.
 * @param {number} r - Индекс ряда, где было введено число.
 * @param {number} c - Индекс столбца, где было введено число.
 * @param {number} num - Число для удаления из заметок.
 */
function autoCleanupNotes(r, c, num) {
    if (num === 0) return; // Нечего удалять, если число стерли

    const boxRowStart = Math.floor(r / 3) * 3;
    const boxColStart = Math.floor(c / 3) * 3;
    let notesChanged = false;

    for (let i = 0; i < SIZE; i++) {
        // Проверяем ряд
        if (notesBoard[r][i].delete(num)) {
            updateNotesDisplay(r, i);
            notesChanged = true;
        }
        // Проверяем столбец
        if (notesBoard[i][c].delete(num)) {
            updateNotesDisplay(i, c);
            notesChanged = true;
        }

        // Проверяем блок 3x3
        const boxR = boxRowStart + Math.floor(i / 3);
        const boxC = boxColStart + (i % 3);
        
        if (notesBoard[boxR][boxC].delete(num)) {
            updateNotesDisplay(boxR, boxC);
            notesChanged = true;
        }
    }
    
    // При вводе числа также очищаем заметки в самой ячейке
    if (notesBoard[r][c].size > 0) {
        notesBoard[r][c].clear();
        updateNotesDisplay(r, c);
        notesChanged = true;
    }

    // Если заметки были изменены, сохраняем состояние
    if (notesChanged) {
        saveState();
    }
}

// =========================================================
// === Input Handling & Validation ===
// =========================================================

function applyKeyValueToSelectedCell(key) {
    if (!selectedCell) return;
    
    // Подсказанные ячейки теперь тоже защищены
    const isProtected = selectedCell.classList.contains('fixed-value') || selectedCell.classList.contains('user-entered');
    if (isProtected) {
        return; 
    }
    
    const input = selectedCell.querySelector('input');
    if (!input) {
        return;
    }

    const r = parseInt(input.dataset.r);
    const c = parseInt(input.dataset.c);
    let stateChanged = false;
    
    const preChangeValue = currentBoard[r][c];

    if (isNotesMode) {
        // --- РЕЖИМ ЗАМЕТОК ---
        if (/[1-9]/.test(key) && key.length === 1) {
            const num = parseInt(key);
            const notes = notesBoard[r][c];
            const currentVal = currentBoard[r][c];

            if (currentVal !== 0) {
                input.value = '';
                currentBoard[r][c] = 0;
                stateChanged = true;
            }
            
            const hadNote = notes.has(num);
            if (hadNote) {
                notes.delete(num);
                stateChanged = true;
            } else {
                notes.add(num);
                stateChanged = true;
            }
            
            updateNotesDisplay(r, c);
            
        } else if (key === 'Delete' || key === 'Backspace' || key === '0') { 
            if (notesBoard[r][c].size > 0) {
                notesBoard[r][c].clear();
                updateNotesDisplay(r, c);
                stateChanged = true;
            }
        } 
        
    } else {
        // --- РЕЖИМ ВВОДА ЗНАЧЕНИЯ ---
        let newVal = '';
        if (key === 'Delete' || key === 'Backspace' || key === '0') { 
            newVal = ''; 
        } else if (/[1-9]/.test(key) && key.length === 1) {
            newVal = key; 
        } 
        
        if (input.value !== newVal) {
            input.value = newVal; 
            stateChanged = true;
        }
        
        // В режиме ввода значения всегда очищаем заметки в текущей ячейке
        if (stateChanged && notesBoard[r][c].size > 0) {
            notesBoard[r][c].clear();
            updateNotesDisplay(r, c);
        }
        
        if (stateChanged) {
             handleInput({ target: input });
        }
        
        const val = input.value;
        const num = val === '' ? 0 : parseInt(val);
        highlightSameValues(num); 

        // ЛОГИКА НАКОПИТЕЛЬНЫХ ОШИБОК
        if (stateChanged) {
            const currentVal = currentBoard[r][c];
            const solutionVal = solutionBoard[r][c];
            
            if (currentVal !== 0 && currentVal !== solutionVal) {
                if (currentVal !== preChangeValue || preChangeValue === 0) {
                    totalErrors++;
                }
            }
        }
        
        // --- НОВАЯ ЛОГИКА АВТОМАТИЧЕСКОЙ ОЧИСТКИ ---
        // Если введено новое число (не стерто)
        if (stateChanged && num !== 0) {
             autoCleanupNotes(r, c, num);
        } else if (stateChanged && preChangeValue !== 0 && num === 0) {
             // Если число стерто, мы не удаляем заметки, но нужно сохранить состояние
             saveState(); 
        }
    }
    
    // Сохраняем состояние ТОЛЬКО если произошли изменения И мы не в режиме ввода числа
    // (потому что autoCleanupNotes уже вызывает saveState в этом случае)
    if (stateChanged && !isNotesMode) {
        const num = input.value === '' ? 0 : parseInt(input.value);
        if (num === 0) {
             saveState();
        }
        // Если num !== 0, saveState() вызовет autoCleanupNotes
    } else if (stateChanged && isNotesMode) {
        saveState();
    }
    
    updateErrors();
}

function handleInput(event) {
    const input = event.target;
    let val = input.value.replace(/[^1-9]/g, '');
    input.value = val;

    const r = parseInt(input.dataset.r);
    const c = parseInt(input.dataset.c);
    
    const num = val === '' ? 0 : parseInt(val);
    currentBoard[r][c] = num;
    
    // В режиме ввода значения заметки в ячейке должны быть очищены
    if (num !== 0) {
        notesBoard[r][c].clear();
        updateNotesDisplay(r, c);
    }
    
    updateErrors();

    if (val.length === 1) {
        checkWinCondition();
    }
    
    highlightSameValues(num); 
}

function handleFocus(event) {
    const cell = event.target.closest('.sudoku-cell');
    if (!cell) return;
    
    selectedCell = cell; 
    highlightRelatedCells(cell);
    
    const input = cell.querySelector('input');
    let valueToHighlight = 0;
    
    if (cell.classList.contains('fixed-value') || cell.classList.contains('user-entered')) {
        valueToHighlight = parseInt(cell.textContent);
    } else if (input) {
        valueToHighlight = parseInt(input.value || '0');
    }
    
    if (valueToHighlight !== 0) {
        highlightSameValues(valueToHighlight);
    }
}

function handleBlur(event) {
    clearHighlights();
    clearValueHighlights(); 
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
            // Проверяем только ячейки, которые были заполнены (не исходные)
            if (initialBoard[r][c] === 0 && val !== 0) { 
                if (val !== solutionBoard[r][c]) {
                    currentErrors++;
                    const cellEl = gridEl.querySelector(`[data-row="${r+1}"][data-col="${c+1}"]`);
                    if (cellEl) cellEl.classList.add('error');
                }
            }
        }
    }
    
    currentDisplayedErrors = currentErrors;
    scoreEl.textContent = totalErrors; 
}

function checkWinCondition() {
    const allFilled = currentBoard.every(row => row.every(val => val !== 0));
    
    if (allFilled) {
        updateErrors(); 
        if (currentDisplayedErrors === 0) { 
            gameOver(true); 
        } 
    }
}

function updateHUD(timeElapsed = 0) {
    scoreEl.textContent = totalErrors;
    
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
    const puzzle = generatePuzzle(solutionBoard, difficulty);
    currentBoard = puzzle.map(row => [...row]);
    initialBoard = puzzle.map(row => [...row]); 
    
    // 2. Reset state
    currentDisplayedErrors = 0;
    totalErrors = 0; 
    selectedCell = null; 
    hintsRemaining = 3; 
    isNotesMode = false; 
    notesBoard = createEmptyNotesBoard(); 
    history = []; 
    hintCells = new Set(); 
    
    // Сохраняем начальное состояние
    saveState();
    
    // 3. Render
    renderBoard();
    
    // 4. Update HUD and start timer
    updateHUD(0);
    updateHintsUI(); 
    updateNotesUI();
    
    // 5. Hide overlay
    hideStartOverlay();
}

function startGame() {
    initGame();
    runTimer();
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
            startMessage.textContent = isNewBest ? 'НОВЫЙ ЛУЧШИЙ РЕЗУЛЬТАТ! Нажмите Enter/клик/любую клавишу, чтобы начать заново.' : 'Отлично! Нажмите Enter/клик/любую клавишу, чтобы начать заново.';
        } else {
            startTitle.textContent = "ИГРА ЗАВЕРШЕНА";
            startOverlay.classList.add('gameover');
            startTitle.style.color = 'var(--color-gold)';
            startScore.textContent = `Ошибок: ${totalErrors}`;
            startMessage.textContent = 'Нажмите любую клавишу, чтобы начать заново.';
        }
    } else {
        startTitle.textContent = "SUDOKU — CyberPunk";
        startTitle.style.color = 'var(--color-magenta)';
        startScore.style.display = 'none';
        startMessage.textContent = 'Нажмите любую клавишу, чтобы начать';
        startOverlay.classList.remove('gameover');
    }
}

function hideStartOverlay() {
    startOverlay.classList.remove('visible'); 
    game.style.pointerEvents = "";
}


// =========================================================
// === Hint Logic ===
// =========================================================

function updateHintsUI() {
    if (hintCounterEl) {
        hintCounterEl.textContent = hintsRemaining;
    }
    if (hintBtn) {
        if (hintsRemaining <= 0) {
            hintBtn.disabled = true;
            hintBtn.style.opacity = '0.5';
        } else {
            hintBtn.disabled = false;
            hintBtn.style.opacity = '1';
        }
    }
}

function handleHint() {
    if (hintsRemaining <= 0 || !gridEl) return;
    
    let emptyCells = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            // Ячейка должна быть заполняемой пользователем И пустой
            if (initialBoard[r][c] === 0 && currentBoard[r][c] === 0) {
                emptyCells.push([r, c]);
            }
        }
    }

    if (emptyCells.length === 0) {
        // Если все ячейки заполнены, подсказку использовать нельзя
        return; 
    }

    let targetR, targetC;
    let targetIndex = -1;
    
    // Приоритет 1: Выбранная пустая ячейка
    if (selectedCell) {
        const r = parseInt(selectedCell.dataset.row) - 1;
        const c = parseInt(selectedCell.dataset.col) - 1;
        
        // Проверяем, находится ли выбранная ячейка в списке пустых
        targetIndex = emptyCells.findIndex(cell => cell[0] === r && cell[1] === c);
    }
    
    // Выбираем либо выбранную, либо случайную
    if (targetIndex !== -1) {
        [targetR, targetC] = emptyCells[targetIndex];
    } else {
        // Выбираем случайную пустую ячейку
        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        [targetR, targetC] = emptyCells[randomIndex];
    }
    
    const targetCell = gridEl.querySelector(`[data-row="${targetR+1}"][data-col="${targetC+1}"]`);

    // ----------------------------------------------------
    // --- Application of Hint (cannot be undone) ---
    // ----------------------------------------------------
    
    const solutionValue = solutionBoard[targetR][targetC];
    
    // 1. DOM/State cleanup
    const inputEl = targetCell.querySelector('input');
    const notesEl = targetCell.querySelector('.notes');
    if (notesEl) notesEl.remove();
    if (inputEl) inputEl.remove();
    
    // 2. Apply value
    targetCell.textContent = solutionValue;
    currentBoard[targetR][targetC] = solutionValue; 
    
    // 3. Mark cell
    hintCells.add(`${targetR},${targetC}`);
    targetCell.classList.add('user-entered'); 
    targetCell.classList.remove('error'); 
    
    // 4. Final steps
    targetCell.addEventListener('click', () => { 
        handleFocus({ target: targetCell }); 
    }); 

    notesBoard[targetR][targetC].clear(); 

    hintsRemaining--;
    updateHintsUI();
    
    // Очистка заметок после применения подсказки
    autoCleanupNotes(targetR, targetC, solutionValue);
    
    updateErrors();
    checkWinCondition();
    
    clearHighlights();
    clearValueHighlights();
    
    handleFocus({ target: targetCell }); 

    // Делаем подсказку необратимой, сбросив историю и сохранив новое состояние
    history = [];
    saveState(); 
}

// =========================================================
// === Notes Logic ===
// =========================================================

function updateNotesUI() {
    if (notesToggleBtn) {
        if (isNotesMode) {
            notesToggleBtn.classList.add('active');
            notesToggleBtn.title = "Режим заметок (ВКЛ)";
        } else {
            notesToggleBtn.classList.remove('active');
            notesToggleBtn.title = "Режим заметок (ВЫКЛ)";
        }
    }
}

function handleNotesToggle() {
    isNotesMode = !isNotesMode;
    updateNotesUI();
    
    if (selectedCell) {
        const input = selectedCell.querySelector('input');
        if (input) {
            input.focus(); 
        } else {
            handleFocus({ target: selectedCell });
        }
    }
}

// =========================================================
// === Controls & Event Listeners ===
// =========================================================
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// === 1. Обработка нажатий на ФИЗИЧЕСКОЙ клавиатуре ===
document.addEventListener("keydown", (e) => {
    // Любое нажатие для старта
    if (startOverlay.classList.contains('visible') && e.key !== 'F5' && e.key !== 'F12') {
        e.preventDefault();
        startGame(); // Запускает игру по ЛЮБОЙ клавише
        return;
    }
    
    if (e.key === 'F5' || e.key === 'F12') {
        return; 
    }
    
    // Toggle Notes Mode
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNotesToggle();
        return;
    }

    // Undo (Ctrl+Z or Cmd+Z)
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
        return;
    }
    
    // Handle number/delete input
    if (selectedCell && (/[0-9]/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        const key = e.key === '0' ? 'Delete' : e.key; 
        applyKeyValueToSelectedCell(key);
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
        
        if (key === 'Notes') {
            handleNotesToggle();
        } else if (key === 'Hint') {
            handleHint();
        } else if (key === 'Undo') { 
            undo();
        } else {
            applyKeyValueToSelectedCell(key);
        }
    });
}

// Любой клик/тач для старта
document.addEventListener("click", (e) => {
    // 1. Исключаем кнопки, которые должны работать, даже если оверлей видим
    if (e.target.closest('#newgame') || e.target.closest('#sound-toggle') || e.target.closest('#virtual-keyboard')) {
        return;
    }
    
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
    
    const bestTime = localStorage.getItem("sudoku_best_time") || "00:00";
    bestEl.textContent = bestTime;

    recalcLayout(); 
    showStartOverlay(); 
    updateSoundIcon();
    updateHintsUI();
    updateNotesUI();
});