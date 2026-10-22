(() => {
  "use strict";

  const CLUES = { easy: 40, medium: 32, hard: 26 };

  const boardEl = document.getElementById("board");
  const numpadEl = document.getElementById("numpad");
  const timerEl = document.getElementById("timer");
  const mistakesEl = document.getElementById("mistakes");
  const messageEl = document.getElementById("message");
  const difficultyEl = document.getElementById("difficulty");
  const notesBtn = document.getElementById("notes-toggle");
  const winModal = document.getElementById("win-modal");
  const winText = document.getElementById("win-text");

  let solution = [];   // 81 digits
  let puzzle = [];     // 81 digits, 0 = empty
  let board = [];      // current values
  let notes = [];      // Set per cell
  let selected = -1;
  let notesMode = false;
  let mistakes = 0;
  let startTime = 0;
  let elapsed = 0;
  let timerId = null;
  let finished = false;

  // ---------- Generation ----------

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function peers(i) {
    const r = Math.floor(i / 9), c = i % 9;
    const set = new Set();
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);
      set.add(k * 9 + c);
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        set.add((br + dr) * 9 + bc + dc);
    set.delete(i);
    return [...set];
  }

  function candidates(grid, i) {
    const used = new Set(peers(i).map(p => grid[p]));
    const out = [];
    for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
    return out;
  }

  // Fills grid in place; returns true on success.
  function fillGrid(grid) {
    let best = -1, bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const c = candidates(grid, i);
      if (bestCands === null || c.length < bestCands.length) {
        best = i; bestCands = c;
        if (c.length <= 1) break;
      }
    }
    if (best === -1) return true;
    for (const d of shuffle(bestCands)) {
      grid[best] = d;
      if (fillGrid(grid)) return true;
      grid[best] = 0;
    }
    return false;
  }

  // Counts solutions up to `limit`, used to guarantee a unique puzzle.
  function countSolutions(grid, limit = 2) {
    let best = -1, bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const c = candidates(grid, i);
      if (bestCands === null || c.length < bestCands.length) {
        best = i; bestCands = c;
        if (c.length === 0) return 0;
      }
    }
    if (best === -1) return 1;
    let count = 0;
    for (const d of bestCands) {
      grid[best] = d;
      count += countSolutions(grid, limit - count);
      grid[best] = 0;
      if (count >= limit) break;
    }
    return count;
  }

  function generatePuzzle(clues) {
    const full = new Array(81).fill(0);
    fillGrid(full);
    const sol = full.slice();
    const work = full.slice();
    const order = shuffle([...Array(81).keys()]);
    let remaining = 81;
    for (const i of order) {
      if (remaining <= clues) break;
      const backup = work[i];
      work[i] = 0;
      if (countSolutions(work.slice()) !== 1) {
        work[i] = backup;
      } else {
        remaining--;
      }
    }
    return { puzzle: work, solution: sol };
  }

  // ---------- Game state ----------

  function newGame() {
    const level = difficultyEl.value;
    const result = generatePuzzle(CLUES[level]);
    puzzle = result.puzzle;
    solution = result.solution;
    board = puzzle.slice();
    notes = Array.from({ length: 81 }, () => new Set());
    selected = -1;
    mistakes = 0;
    finished = false;
    mistakesEl.textContent = "0";
    setMessage("");
    startTimer();
    render();
  }

  function startTimer() {
    clearInterval(timerId);
    elapsed = 0;
    startTime = Date.now();
    timerId = setInterval(() => {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerEl.textContent = formatTime(elapsed);
    }, 500);
    timerEl.textContent = "00:00";
  }

  function stopTimer() {
    clearInterval(timerId);
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = formatTime(elapsed);
  }

  function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  function setMessage(text) {
    messageEl.textContent = text;
  }

  // ---------- Rendering ----------

  function render() {
    boardEl.innerHTML = "";
    const selVal = selected >= 0 ? board[selected] : 0;
    const selRow = selected >= 0 ? Math.floor(selected / 9) : -1;
    const selCol = selected >= 0 ? selected % 9 : -1;
    const selBox = selected >= 0 ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;

    for (let i = 0; i < 81; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = i;

      const r = Math.floor(i / 9), c = i % 9;
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);

      if (selected >= 0) {
        if (i === selected) cell.classList.add("selected");
        else if (r === selRow || c === selCol || box === selBox) cell.classList.add("highlight");
        if (selVal && board[i] === selVal && i !== selected) cell.classList.add("same");
      }

      if (puzzle[i] !== 0) cell.classList.add("given");

      if (board[i] !== 0) {
        cell.textContent = board[i];
        if (board[i] !== solution[i]) cell.classList.add("error");
      } else if (notes[i].size > 0) {
        const grid = document.createElement("div");
        grid.className = "notes";
        for (let d = 1; d <= 9; d++) {
          const s = document.createElement("span");
          s.textContent = notes[i].has(d) ? d : "";
          grid.appendChild(s);
        }
        cell.appendChild(grid);
      }

      cell.addEventListener("click", () => select(i));
      boardEl.appendChild(cell);
    }

    renderNumpad();
  }

  function renderNumpad() {
    numpadEl.innerHTML = "";
    for (let d = 1; d <= 9; d++) {
      const btn = document.createElement("button");
      btn.textContent = d;
      const count = board.filter(v => v === d).length;
      btn.disabled = count >= 9 || finished;
      btn.addEventListener("click", () => enter(d));
      numpadEl.appendChild(btn);
    }
  }

  function select(i) {
    selected = i;
    render();
  }

  // ---------- Input ----------

  function enter(d) {
    if (finished || selected < 0) return;
    if (puzzle[selected] !== 0) return; // given cell

    if (notesMode) {
      if (board[selected] !== 0) return;
      if (notes[selected].has(d)) notes[selected].delete(d);
      else notes[selected].add(d);
      render();
      return;
    }

    if (board[selected] === d) return;

    board[selected] = d;
    notes[selected].clear();
    // Clear this digit from notes of peers
    for (const p of peers(selected)) notes[p].delete(d);

    if (d !== solution[selected]) {
      mistakes++;
      mistakesEl.textContent = mistakes;
      setMessage("That number doesn't match the solution.");
    } else {
      setMessage("");
      checkWin();
    }
    render();
  }

  function erase() {
    if (finished || selected < 0 || puzzle[selected] !== 0) return;
    board[selected] = 0;
    notes[selected].clear();
    setMessage("");
    render();
  }

  function hint() {
    if (finished) return;
    if (selected >= 0 && puzzle[selected] === 0 && board[selected] !== solution[selected]) {
      board[selected] = solution[selected];
      notes[selected].clear();
      setMessage("Hint applied.");
      checkWin();
      render();
      return;
    }
    const empties = [];
    for (let i = 0; i < 81; i++) if (board[i] !== solution[i]) empties.push(i);
    if (empties.length === 0) return;
    selected = empties[Math.floor(Math.random() * empties.length)];
    board[selected] = solution[selected];
    notes[selected].clear();
    setMessage("Hint: filled one cell.");
    checkWin();
    render();
  }

  function check() {
    let wrong = 0, empty = 0;
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) empty++;
      else if (board[i] !== solution[i]) wrong++;
    }
    if (wrong === 0 && empty === 0) {
      checkWin();
    } else if (wrong > 0) {
      setMessage(`${wrong} cell${wrong > 1 ? "s are" : " is"} incorrect.`);
    } else {
      setMessage(`Looks good so far. ${empty} cell${empty > 1 ? "s" : ""} left.`);
    }
  }

  function checkWin() {
    if (finished) return;
    if (board.every((v, i) => v === solution[i])) {
      finished = true;
      stopTimer();
      winText.textContent = `Time ${formatTime(elapsed)} · Mistakes ${mistakes}`;
      winModal.classList.remove("hidden");
      renderNumpad();
    }
  }

  // ---------- Events ----------

  document.getElementById("new-game").addEventListener("click", newGame);
  document.getElementById("win-new").addEventListener("click", () => {
    winModal.classList.add("hidden");
    newGame();
  });
  document.getElementById("erase").addEventListener("click", erase);
  document.getElementById("hint").addEventListener("click", hint);
  document.getElementById("check").addEventListener("click", check);

  notesBtn.addEventListener("click", () => {
    notesMode = !notesMode;
    notesBtn.textContent = `Notes: ${notesMode ? "on" : "off"}`;
    notesBtn.classList.toggle("on", notesMode);
  });

  document.addEventListener("keydown", (e) => {
    if (winModal.classList.contains("hidden") === false) return;
    if (e.key >= "1" && e.key <= "9") enter(Number(e.key));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
    else if (e.key === "n" || e.key === "N") notesBtn.click();
    else if (e.key === "h" || e.key === "H") hint();
    else if (selected >= 0 && e.key.startsWith("Arrow")) {
      let r = Math.floor(selected / 9), c = selected % 9;
      if (e.key === "ArrowUp") r = Math.max(0, r - 1);
      if (e.key === "ArrowDown") r = Math.min(8, r + 1);
      if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
      if (e.key === "ArrowRight") c = Math.min(8, c + 1);
      e.preventDefault();
      select(r * 9 + c);
    }
  });

  difficultyEl.addEventListener("change", newGame);

  newGame();
})();
