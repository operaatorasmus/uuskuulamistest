const LISTENING_SECONDS = 60;
const LOAD_WARNING_MS = 8000;
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
audio.preload = "auto";

const state = {
  selectedClass: null,
  queue: [],
  queueIndex: 0,
  round: 1,
  currentTrack: null,
  currentStart: 0,
  revealed: false,
  isLoading: false,
  timerId: null,
  loadWarningTimerId: null,
  loadToken: 0,
  metadataHandler: null,
  errorHandler: null,
  stalledHandler: null,
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

function setStatus(text, { loading = false, error = false } = {}) {
  elements.statusLine.textContent = text;
  elements.statusLine.classList.toggle("is-loading", loading);
  elements.statusLine.classList.toggle("is-error", error);
  elements.statusLine.setAttribute("aria-busy", loading ? "true" : "false");
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

function clearPendingLoad() {
  clearTimeout(state.loadWarningTimerId);
  state.loadWarningTimerId = null;

  if (state.metadataHandler) {
    audio.removeEventListener("loadedmetadata", state.metadataHandler);
    state.metadataHandler = null;
  }

  if (state.errorHandler) {
    audio.removeEventListener("error", state.errorHandler);
    state.errorHandler = null;
  }

  if (state.stalledHandler) {
    audio.removeEventListener("stalled", state.stalledHandler);
    audio.removeEventListener("waiting", state.stalledHandler);
    state.stalledHandler = null;
  }
}

function setLoadingControls(isLoading) {
  state.isLoading = isLoading;
  elements.playPauseButton.disabled = isLoading;
  elements.revealButton.disabled = isLoading;

  if (isLoading) {
    elements.nextButton.disabled = true;
  }
}

function showSlowLoadState(loadToken) {
  if (loadToken !== state.loadToken || !state.isLoading) {
    return;
  }

  setStatus("Laadimine võtab kauem", { loading: true });
  elements.revealButton.disabled = false;
  elements.nextButton.disabled = false;
}

function showLoadError(loadToken) {
  if (loadToken !== state.loadToken || state.revealed) {
    return;
  }

  clearPendingLoad();
  setLoadingControls(false);
  elements.nextButton.disabled = false;
  setPlayIcon(false);
  setStatus("Teost ei õnnestunud laadida", { error: true });
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
  if (state.isLoading) {
    return;
  }

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
  state.loadToken += 1;
  const loadToken = state.loadToken;
  clearPendingLoad();
  clearInterval(state.timerId);
  audio.pause();
  setPlayIcon(false);
  hideAnswer();
  resetTimer();
  updateMetaLabels();

  state.currentTrack = state.queue[state.queueIndex];
  state.currentStart = 0;
  audio.src = state.currentTrack.src;
  setStatus("Laen teost", { loading: true });
  setLoadingControls(true);

  state.metadataHandler = () => {
    if (loadToken !== state.loadToken) {
      return;
    }

    clearPendingLoad();
    state.currentStart = pickRandomStart(audio.duration);
    try {
      audio.currentTime = state.currentStart;
    } catch (error) {
      state.currentStart = 0;
    }
    setLoadingControls(false);
    elements.nextButton.disabled = true;

    if (autoplay) {
      playAudio();
    } else {
      setStatus("Valmis");
    }
  };

  state.errorHandler = () => showLoadError(loadToken);
  state.stalledHandler = () => showSlowLoadState(loadToken);

  audio.addEventListener("loadedmetadata", state.metadataHandler, { once: true });
  audio.addEventListener("error", state.errorHandler, { once: true });
  audio.addEventListener("stalled", state.stalledHandler);
  audio.addEventListener("waiting", state.stalledHandler);
  state.loadWarningTimerId = setTimeout(
    () => showSlowLoadState(loadToken),
    LOAD_WARNING_MS
  );
  audio.load();
}

function revealAnswer(status = "Vastus avatud", { keepPlaying = false } = {}) {
  if (!state.currentTrack) {
    return;
  }

  const shouldKeepPlaying = keepPlaying && !audio.ended && !audio.paused;

  state.loadToken += 1;
  clearPendingLoad();
  setLoadingControls(false);
  state.revealed = true;
  clearInterval(state.timerId);

  if (shouldKeepPlaying) {
    setPlayIcon(true);
  } else {
    audio.pause();
    setPlayIcon(false);
  }

  elements.revealButton.disabled = true;
  elements.playPauseButton.disabled = true;
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
  state.loadToken += 1;
  clearPendingLoad();
  setLoadingControls(false);
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

elements.revealButton.addEventListener("click", () => {
  revealAnswer("Vastus avatud", { keepPlaying: true });
});

elements.nextButton.addEventListener("click", () => {
  advanceQueue();
  loadCurrentTrack({ autoplay: true });
});

elements.playPauseButton.addEventListener("click", () => {
  if (state.revealed || state.isLoading || !state.currentTrack) {
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
  setPlayIcon(false);

  if (!state.revealed) {
    revealAnswer("Teos lõppes");
  }
});

renderClassCards();
