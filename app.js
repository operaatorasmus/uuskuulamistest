const LISTENING_SECONDS = 60;
const library = Array.isArray(window.LISTENING_TEST_LIBRARY)
  ? window.LISTENING_TEST_LIBRARY
  : [];

const elements = {
  classView: document.querySelector("#classView"),
  practiceView: document.querySelector("#practiceView"),
  classGrid: document.querySelector("#classGrid"),
  selectedClassLabel: document.querySelector("#selectedClassLabel"),
  roundLabel: document.querySelector("#roundLabel"),
  trackCounter: document.querySelector("#trackCounter"),
  timerRing: document.querySelector("#timerRing"),
  timeLeft: document.querySelector("#timeLeft"),
  statusLine: document.querySelector("#statusLine"),
  playPauseButton: document.querySelector("#playPauseButton"),
  revealButton: document.querySelector("#revealButton"),
  answerPanel: document.querySelector("#answerPanel"),
  answerText: document.querySelector("#answerText"),
  nextButton: document.querySelector("#nextButton"),
  changeClassButton: document.querySelector("#changeClassButton"),
};

const audio = new Audio();
audio.preload = "metadata";

const state = {
  selectedClass: null,
  queue: [],
  queueIndex: 0,
  round: 1,
  currentTrack: null,
  currentStart: 0,
  revealed: false,
  timerId: null,
  metadataHandler: null,
};

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function setStatus(text) {
  elements.statusLine.textContent = text;
}

function setPlayIcon(isPlaying) {
  const icon = elements.playPauseButton.querySelector("span[aria-hidden='true']");
  icon.className = isPlaying ? "icon-pause" : "icon-play";
  elements.playPauseButton.title = isPlaying ? "Paus" : "Esita";
  elements.playPauseButton.querySelector(".sr-only").textContent = isPlaying ? "Paus" : "Esita";
}

function resetTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
  elements.timeLeft.textContent = formatTime(LISTENING_SECONDS);
  elements.timerRing.style.setProperty("--progress", "0deg");
}

function updateTimer() {
  const elapsed = Math.max(0, audio.currentTime - state.currentStart);
  const remaining = Math.max(0, LISTENING_SECONDS - elapsed);
  const progress = Math.min(360, (elapsed / LISTENING_SECONDS) * 360);

  elements.timeLeft.textContent = formatTime(remaining);
  elements.timerRing.style.setProperty("--progress", `${progress}deg`);

  if (remaining <= 0 && !state.revealed) {
    revealAnswer("Aeg sai täis");
  }
}

function startTimer() {
  clearInterval(state.timerId);
  updateTimer();
  state.timerId = setInterval(updateTimer, 250);
}

function pickRandomStart(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  const latestStart = Math.max(0, duration - LISTENING_SECONDS);
  return Math.random() * latestStart;
}

function startNewRound() {
  state.queue = shuffle(state.selectedClass.tracks);
  state.queueIndex = 0;
}

function advanceQueue() {
  state.queueIndex += 1;
  if (state.queueIndex >= state.queue.length) {
    state.round += 1;
    startNewRound();
  }
}

function updateMetaLabels() {
  elements.selectedClassLabel.textContent = state.selectedClass.label;
  elements.roundLabel.textContent = `Ring ${state.round}`;
  elements.trackCounter.textContent = `${state.queueIndex + 1} / ${state.queue.length}`;
}

function hideAnswer() {
  state.revealed = false;
  elements.answerPanel.classList.remove("is-revealed");
  elements.answerText.textContent = "Peidetud";
  elements.revealButton.disabled = false;
  elements.nextButton.disabled = true;
}

async function playAudio() {
  try {
    await audio.play();
    setPlayIcon(true);
    setStatus("Kuula ja mõtle");
    startTimer();
  } catch (error) {
    setPlayIcon(false);
    setStatus("Vajuta esita");
  }
}

function loadCurrentTrack({ autoplay = true } = {}) {
  clearInterval(state.timerId);
  audio.pause();
  setPlayIcon(false);
  hideAnswer();
  resetTimer();
  updateMetaLabels();

  state.currentTrack = state.queue[state.queueIndex];
  state.currentStart = 0;
  audio.src = state.currentTrack.src;
  setStatus("Laen teost");

  if (state.metadataHandler) {
    audio.removeEventListener("loadedmetadata", state.metadataHandler);
  }

  state.metadataHandler = () => {
    state.currentStart = pickRandomStart(audio.duration);
    audio.currentTime = state.currentStart;

    if (autoplay) {
      playAudio();
    } else {
      setStatus("Valmis");
    }
  };

  audio.addEventListener("loadedmetadata", state.metadataHandler, { once: true });
  audio.load();
}

function revealAnswer(status = "Vastus avatud") {
  if (!state.currentTrack) {
    return;
  }

  state.revealed = true;
  clearInterval(state.timerId);
  audio.pause();
  setPlayIcon(false);
  elements.revealButton.disabled = true;
  elements.nextButton.disabled = false;
  elements.answerPanel.classList.add("is-revealed");
  elements.answerText.textContent = state.currentTrack.answer;
  setStatus(status);
}

function selectClass(classItem) {
  if (!classItem.tracks.length) {
    return;
  }

  state.selectedClass = classItem;
  state.round = 1;
  startNewRound();

  elements.classView.classList.add("is-hidden");
  elements.practiceView.classList.remove("is-hidden");
  elements.changeClassButton.classList.remove("is-hidden");
  loadCurrentTrack({ autoplay: true });
}

function showClassPicker() {
  clearInterval(state.timerId);
  audio.pause();
  setPlayIcon(false);
  elements.practiceView.classList.add("is-hidden");
  elements.classView.classList.remove("is-hidden");
  elements.changeClassButton.classList.add("is-hidden");
}

function renderClassCards() {
  elements.classGrid.replaceChildren();

  if (!library.length) {
    const empty = document.createElement("p");
    empty.className = "status-line";
    empty.textContent = "Ühtegi klassikausta ei leitud";
    elements.classGrid.append(empty);
    return;
  }

  library.forEach((classItem) => {
    const button = document.createElement("button");
    button.className = "class-card";
    button.type = "button";
    button.disabled = classItem.tracks.length === 0;

    const label = document.createElement("strong");
    label.textContent = classItem.label;

    const count = document.createElement("span");
    count.textContent = classItem.tracks.length
      ? `${classItem.tracks.length} teost`
      : "failid lisamata";

    button.append(label, count);
    button.addEventListener("click", () => selectClass(classItem));
    elements.classGrid.append(button);
  });
}

elements.revealButton.addEventListener("click", () => revealAnswer("Vastus avatud"));

elements.nextButton.addEventListener("click", () => {
  advanceQueue();
  loadCurrentTrack({ autoplay: true });
});

elements.playPauseButton.addEventListener("click", () => {
  if (state.revealed || !state.currentTrack) {
    return;
  }

  if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
    clearInterval(state.timerId);
    setPlayIcon(false);
    setStatus("Paus");
  }
});

elements.changeClassButton.addEventListener("click", showClassPicker);

audio.addEventListener("ended", () => {
  if (!state.revealed) {
    revealAnswer("Teos lõppes");
  }
});

renderClassCards();
