import { WIDTH, HEIGHT, PHYSICS, createGame, startGame, stepGame, tapTrap, tapDog, pauseGame, resumeGame } from './game.js';
import { drawGame } from './render.js';
import { GameAudio } from './audio.js';
import { setupPwa } from './pwa.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const frame = $('#game-frame');
const menu = $('#menu');
const pausedPanel = $('#pause-panel');
const overPanel = $('#over-panel');
const trapNotice = $('#trap-notice');
const helpDialog = $('#help-dialog');
const creatureMode = new URLSearchParams(window.location.search).get('creature') === 'test' ? 'test' : 'release';
$('#creature-test-notice').hidden = creatureMode !== 'test';
// Both help surfaces share the same device-specific guide content.
$('#help-content').append($('.intro').cloneNode(true));
const keys = new Set();
const tapKeys = new Set();
const downPointers = new Set();
const touchControls = matchMedia('(pointer: coarse)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const settingsKey = 'ponppu.settings.v1';
const recordKey = 'ponppu.record.v1';
let storageAvailable = true;

function readStorage(key) {
  try { return localStorage.getItem(key); }
  catch { storageAvailable = false; return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, value); }
  catch { storageAvailable = false; $('#storage-notice').hidden = false; }
}
let settings = { theme: 'meadow', sound: true, music: true };
const storedSettings = readStorage(settingsKey);
if (storedSettings) {
  try {
    const parsed = JSON.parse(storedSettings);
    if (['meadow', 'autumn', 'winter'].includes(parsed.theme)) settings.theme = parsed.theme;
    // The archived Kvltist world is hidden; its saved selection moves to Talvi.
    if (parsed.theme === 'kvlt') settings.theme = 'winter';
    if (typeof parsed.sound === 'boolean') settings.sound = parsed.sound;
    if (typeof parsed.music === 'boolean') settings.music = parsed.music;
  } catch { /* Invalid saved preferences are discarded; physics never uses storage. */ }
}
const savedRecord = Number(readStorage(recordKey));
let best = Number.isFinite(savedRecord) && savedRecord >= 0 ? Math.floor(savedRecord) : 0;
$('#storage-notice').hidden = storageAvailable;
const audio = new GameAudio(settings.sound, settings.music);
let game = createGame(20260918, { creatureMode });
let joystick = null;
let petEffects = { time: 0, hearts: [] };
let accumulator = 0;
let previousTime = 0;
let updateReady = false;
let lastUpdateState = null;
let wasTrapped = false;
let deferredInstall = null;
let lastScore = -1;
let lastPhase = null;
let lastTapCount = -1;
let lastCombo = -1;
let recordBeforeRound = best;

function refreshControlMode() {
  document.body.dataset.inputMode = touchControls.matches ? 'touch' : 'keyboard';
  canvas.setAttribute('aria-label', touchControls.matches
    ? 'Pystysuuntainen pomppupeli. Ohjaa vetämällä sormea pelialueen alemmalla puoliskolla. Vapauta ansasta kymmenellä napautuksella. Taputtele otusta kymmenellä napautuksella.'
    : 'Pystysuuntainen pomppupeli. Ohjaa vasemmalla ja oikealla nuolella. Vapauta ansasta kymmenellä nuolinäppäimen tai välilyönnin painalluksella. Taputtele otusta kymmenellä vasemman tai oikean nuolen painalluksella tai hiiren klikkauksella.');
}
touchControls.addEventListener('change', refreshControlMode);
refreshControlMode();

function announce(message) { $('#announcer').textContent = message; }
function saveSettings() { writeStorage(settingsKey, JSON.stringify(settings)); }
function refreshBest() { document.querySelectorAll('.best-score').forEach((element) => { element.textContent = best; }); }
function refreshSound() {
  $('#sound').setAttribute('aria-pressed', String(settings.sound));
  const label = settings.sound ? 'Mykistä ääniefektit' : 'Ota ääniefektit käyttöön';
  $('#sound').setAttribute('aria-label', label);
  $('#sound').setAttribute('title', label);
}
function refreshMusic() {
  $('#music').setAttribute('aria-pressed', String(settings.music));
  $('#music').setAttribute('aria-label', settings.music ? 'Music off' : 'Music on');
  $('#music').setAttribute('title', settings.music ? 'Music off' : 'Music on');
}
function setTheme(theme) {
  settings.theme = theme;
  frame.dataset.theme = theme;
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  const surfaceColor = { meadow: '#e6edda', autumn: '#efdbb6', kvlt: '#242034', winter: '#101d30' }[theme];
  document.documentElement.style.backgroundColor = surfaceColor;
  $('meta[name="theme-color"]').setAttribute('content', surfaceColor);
  audio.setScene(theme, game.phase);
}
function clearInput() {
  keys.clear();
  tapKeys.clear();
  if (joystick && canvas.hasPointerCapture(joystick.id)) canvas.releasePointerCapture(joystick.id);
  joystick = null;
}
function processEvents() {
  for (const event of game.events.splice(0)) {
    audio.play(event.type, settings.theme);
    if (event.type === 'dog') {
      petEffects = { time: 0, hearts: [] };
      clearInput();
      announce(touchControls.matches
        ? 'Taputtele otusta! Napauta ruutua kymmenen kertaa.'
        : 'Taputtele otusta! Paina vasenta tai oikeaa nuolta kymmenen kertaa tai klikkaa hiirellä.');
    }
    if (event.type === 'trap') {
      clearInput();
      announce(touchControls.matches
        ? 'Jalka jäi ansaan. Napauta kymmenen kertaa.'
        : 'Jalka jäi ansaan. Paina nuolinäppäimiä tai välilyöntiä kymmenen kertaa.');
    }
    if (event.type === 'satsuma') announce(`${game.bubble} Kolminkertainen hyppy!${game.satsumaStreak >= 3 ? ` ${game.satsumaStreak} välipalan kombo!` : ''}`);
    if (event.type === 'release') announce('Vapaa!');
    if (event.type === 'pet-boost') {
      clearInput();
      announce(`Vihreä hehku! Pupu ampaisee ${game.petBoost.riseMeters} metriä ylöspäin!`);
    }
    if (event.type === 'pet-boost-release') {
      clearInput();
      audio.play('release', settings.theme);
      announce('Ampaisu valmis. Pompitaan!');
    }
    if (event.type === 'slip') announce('Hyi kakkaa!');
    if (event.type === 'over') finishRound();
  }
}
function startRound() {
  petEffects = { time: 0, hearts: [] };
  clearInput();
  downPointers.clear();
  audio.unlock();
  recordBeforeRound = best;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  game = createGame(seed, { creatureMode });
  startGame(game);
  accumulator = 0;
  processEvents();
  refreshUi();
  canvas.focus({ preventScroll: true });
  announce('Peli alkoi. Ohjaa pupua sivusuunnassa.');
}
function finishRound() {
  clearInput();
  const score = Math.floor(game.score);
  if (score > best) {
    best = score;
    writeStorage(recordKey, String(best));
  }
  refreshBest();
  $('#final-score').textContent = score;
  $('#over-tag').textContent = score > recordBeforeRound ? 'UUSI OMA ENNÄTYS!' : 'HYVÄ POMPPU!';
  announce(`Kierros päättyi. ${score} metriä. Oma ennätys ${best} metriä.`);
  refreshUi();
  $('#restart').focus({ preventScroll: true });
}
function showMenu() {
  petEffects = { time: 0, hearts: [] };
  clearInput();
  game = createGame(20260918, { creatureMode });
  accumulator = 0;
  refreshUi();
  $('#start').focus({ preventScroll: true });
}
function togglePause() {
  if (game.phase === 'playing') {
    pauseGame(game);
    clearInput();
    announce('Peli on tauolla.');
    refreshUi();
    $('#resume').focus({ preventScroll: true });
  } else if (game.phase === 'paused') {
    resumeGame(game);
    accumulator = 0;
    audio.unlock();
    refreshUi();
    canvas.focus({ preventScroll: true });
    announce('Peli jatkuu.');
  }
}
function refreshUi() {
  const score = Math.floor(game.score);
  if (score !== lastScore) { $('#score').textContent = score; lastScore = score; }
  const combo = game.phase === 'playing' ? game.satsumaStreak : 0;
  if (combo !== lastCombo) {
    $('#combo').hidden = combo < 3;
    $('#combo').textContent = combo >= 3 ? `${combo}× KOMBO` : '';
    lastCombo = combo;
  }
  if (game.phase !== lastPhase) {
    menu.hidden = game.phase !== 'ready';
    pausedPanel.hidden = game.phase !== 'paused';
    overPanel.hidden = game.phase !== 'over';
    frame.dataset.phase = game.phase;
    $('#pause').disabled = game.phase !== 'playing';
    audio.setScene(settings.theme, game.phase);
    lastPhase = game.phase;
  }
  const trapped = game.phase === 'playing' && game.player.state === 'trapped';
  if (trapped !== wasTrapped || game.trapTaps !== lastTapCount) {
    trapNotice.hidden = !trapped;
    if (trapped) {
      $('#trap-dots').textContent = Array.from({ length: PHYSICS.trapTaps }, (_, index) => index < game.trapTaps ? '●' : '○').join(' ');
    }
    wasTrapped = trapped;
    lastTapCount = game.trapTaps;
  }
  const petting = game.phase === 'playing' && game.player.state === 'petting';
  const pet = petting ? game.platforms.find((platform) => platform.id === game.player.platformId).dog : null;
  const boost = game.phase === 'playing' && game.player.state === 'pet-boost' ? game.petBoost : null;
  audio.setPetting(pet?.kind === 'zab' ? 'zab' : null);
  audio.setBoost(boost && boost.elapsed >= boost.chargeDuration
    ? Math.min(1, (boost.elapsed - boost.chargeDuration) / boost.launchDuration) : null,
  PHYSICS.petBoostLaunchDuration);
  $('#dog-notice').hidden = !petting;
  if (petting) {
    $('#pet-title').textContent = 'Taputtele otusta!';
    $('#dog-count').textContent = `${game.dogTaps}/${PHYSICS.dogTaps}`;
  }
  refreshUpdateNotice();
}

function refreshUpdateNotice() {
  const canUpdate = ['ready', 'over'].includes(game.phase);
  const state = !updateReady ? 'hidden' : canUpdate ? 'available' : 'after-round';
  if (state === lastUpdateState) return;
  lastUpdateState = state;
  $('#update-notice').hidden = !updateReady;
  document.body.dataset.updateReady = String(updateReady);
  $('#update-message').textContent = !updateReady ? '' : canUpdate
    ? 'Uusi versio on valmis.' : 'Päivitys valmis kierroksen jälkeen.';
  const button = $('#update');
  button.hidden = !updateReady || !canUpdate;
  button.disabled = !updateReady || !canUpdate;
  button.textContent = 'Päivitä peli';
}

$('#start').addEventListener('click', startRound);
$('#restart').addEventListener('click', startRound);
$('#pause').addEventListener('click', togglePause);
$('#resume').addEventListener('click', togglePause);
$('#back-menu').addEventListener('click', showMenu);
$('#change-world').addEventListener('click', showMenu);
$('#help-open').addEventListener('click', () => {
  if (game.phase !== 'ready' || helpDialog.open) return;
  helpDialog.showModal();
  $('#help-content').scrollTop = 0;
  $('#help-close').focus({ preventScroll: true });
});
$('#help-close').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  helpDialog.close();
});
helpDialog.addEventListener('close', () => $('#help-open').focus({ preventScroll: true }));
$('#sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  audio.setEnabled(settings.sound);
  refreshSound();
  saveSettings();
  if (game.phase === 'playing') canvas.focus({ preventScroll: true });
});
$('#music').addEventListener('click', () => {
  settings.music = !settings.music;
  audio.setMusicEnabled(settings.music);
  refreshMusic();
  saveSettings();
  if (game.phase === 'playing') canvas.focus({ preventScroll: true });
});
document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => { setTheme(button.dataset.themeChoice); audio.unlock(); saveSettings(); });
});

function petOnce() {
  if (tapDog(game)) {
    petEffects.hearts.push({ born: petEffects.time, stroke: game.dogTaps });
  }
  processEvents();
  refreshUi();
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * WIDTH / bounds.width, y: (event.clientY - bounds.top) * HEIGHT / bounds.height };
}
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (downPointers.has(event.pointerId)) return;
  downPointers.add(event.pointerId);
  event.preventDefault();
  const point = pointFromEvent(event);
  if (game.phase === 'ready' && point.y >= HEIGHT / 2) startRound();
  if (game.phase !== 'playing') return;
  audio.unlock();
  if (game.player.state === 'pet-boost') return;
  if (game.player.state === 'petting') {
    petOnce();
    return;
  }
  if (game.player.state === 'trapped') {
    tapTrap(game);
    processEvents();
    refreshUi();
    return; // The freeing tap is consumed; a fresh touch starts the next joystick.
  }
  if (point.y < HEIGHT / 2 || joystick !== null) return;
  joystick = { id: event.pointerId, x: point.x, y: point.y, dx: 0, dy: 0 };
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', (event) => {
  if (joystick?.id !== event.pointerId) return;
  const point = pointFromEvent(event);
  joystick.dx = Math.max(-52, Math.min(52, point.x - joystick.x));
  joystick.dy = Math.max(-30, Math.min(30, point.y - joystick.y));
});
function endPointer(event) {
  downPointers.delete(event.pointerId);
  if (joystick?.id === event.pointerId) joystick = null;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && ['playing', 'paused'].includes(game.phase)) {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }
  if (game.phase !== 'playing') return;
  // Preserve native keyboard activation while a UI control has focus.
  if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  if (game.player.state === 'pet-boost') return;
  if (game.player.state === 'petting') {
    if (['ArrowLeft', 'ArrowRight'].includes(event.code) && !event.repeat && !tapKeys.has(event.code)) {
      tapKeys.add(event.code);
      audio.unlock();
      petOnce();
    }
    return;
  }
  const isTapKey = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code);
  if (game.player.state === 'trapped' && isTapKey) {
    if (!event.repeat && !tapKeys.has(event.code)) {
      tapKeys.add(event.code);
      tapTrap(game);
      processEvents();
      refreshUi();
    }
    return;
  }
  // A key that freed the bunny must be released before it can steer again.
  if (tapKeys.has(event.code)) return;
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') keys.add(event.code);
});
window.addEventListener('keyup', (event) => { keys.delete(event.code); tapKeys.delete(event.code); });
function pauseOnLeave() {
  downPointers.clear();
  clearInput();
  if (game.phase === 'playing') togglePause();
}
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });

const pwa = setupPwa({
  onUpdateReady() { updateReady = true; refreshUi(); },
});
$('#update').addEventListener('click', async () => {
  const button = $('#update');
  if (!updateReady || !['ready', 'over'].includes(game.phase) || button.disabled) return;
  button.disabled = true;
  button.textContent = 'Päivitetään…';
  if (!await pwa.applyUpdate()) { button.disabled = false; button.textContent = 'Yritä uudelleen'; }
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); deferredInstall = event; $('#install').hidden = false;
});
$('#install').addEventListener('click', async () => {
  if (!deferredInstall) return;
  pauseOnLeave();
  await deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('#install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#install').hidden = true; deferredInstall = null; });

function getAxis() {
  if (game.player.state === 'pet-boost') return 0;
  if (keys.has('ArrowLeft') || keys.has('ArrowRight')) return Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  if (!joystick) return 0;
  const delta = joystick.dx;
  return Math.abs(delta) <= 5 ? 0 : Math.sign(delta) * Math.min(1, (Math.abs(delta) - 5) / 42);
}
function loop(milliseconds) {
  const elapsed = previousTime === 0 ? 0 : (milliseconds - previousTime) / 1000;
  previousTime = milliseconds;
  if (game.phase === 'playing') {
    // A suspended/overloaded browser must not fast-forward the bunny into a loss.
    if (elapsed > .3) togglePause();
    else {
      // Presentation keeps moving during petting, while world physics stays frozen.
      petEffects.time += elapsed;
      petEffects.hearts = petEffects.hearts.filter((heart) => petEffects.time - heart.born < 1.4);
      accumulator += elapsed;
      while (accumulator >= 1 / 120 && game.phase === 'playing') {
        stepGame(game, 1 / 120, getAxis());
        processEvents();
        accumulator -= 1 / 120;
      }
    }
  } else accumulator = 0;
  drawGame(ctx, game, { theme: settings.theme, time: milliseconds / 1000, joystick, petEffects, reducedMotion: reducedMotion.matches });
  refreshUi();
  requestAnimationFrame(loop);
}
setTheme(settings.theme);
refreshSound();
refreshMusic();
refreshBest();
refreshUi();
requestAnimationFrame(loop);
