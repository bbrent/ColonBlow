export function createHud() {
  const el = {
    title: document.getElementById('title-screen'),
    startBtn: document.getElementById('start-btn'),
    hudBar: document.getElementById('hud-bar'),
    progressFill: document.getElementById('progress-fill'),
    timeFill: document.getElementById('time-fill'),
    timeLabel: document.getElementById('time-label'),
    message: document.getElementById('center-message'),
    end: document.getElementById('end-screen'),
    endTitle: document.getElementById('end-title'),
    endSub: document.getElementById('end-sub'),
    restartBtn: document.getElementById('restart-btn'),
    hitFlash: document.getElementById('hit-flash'),
    boostIcon: document.getElementById('boost-icon'),
    levelName: document.getElementById('level-name'),
  };

  return {
    setLevelName(name) {
      el.levelName.textContent = name;
    },
    showTitle() {
      el.title.classList.remove('hidden');
      el.hudBar.classList.add('hidden');
    },
    hideTitle() {
      el.title.classList.add('hidden');
      el.hudBar.classList.remove('hidden');
    },
    showMessage(text) {
      el.message.textContent = text;
      el.message.classList.remove('hidden');
    },
    hideMessage() {
      el.message.classList.add('hidden');
    },
    updateHUD(t, timeLeft, total) {
      el.progressFill.style.width = `${Math.min(100, t * 100)}%`;
      el.timeFill.style.width = `${Math.max(0, (timeLeft / total) * 100)}%`;
      el.timeLabel.textContent = `${Math.ceil(timeLeft)}s`;
    },
    flashHit() {
      el.hitFlash.classList.add('active');
      setTimeout(() => el.hitFlash.classList.remove('active'), 250);
    },
    pulseBoost() {
      el.boostIcon.classList.add('active');
      setTimeout(() => el.boostIcon.classList.remove('active'), 300);
    },
    showEnd(won, levelName, campaignComplete = false) {
      el.hudBar.classList.add('hidden');
      el.end.classList.remove('hidden');
      if (won && campaignComplete) {
        el.endTitle.textContent = 'FULLY DIGESTED!';
        el.endSub.textContent = `You guided the food through every creature, from ${levelName ? 'worm to ' + levelName : 'worm to alien'}. Campaign complete!`;
      } else if (won) {
        el.endTitle.textContent = 'DELIVERED!';
        el.endSub.textContent = `The ${levelName} processed the food in time.`;
      } else {
        el.endTitle.textContent = "TIME'S UP!";
        el.endSub.textContent = `Constipation strikes! The food never made it through the ${levelName}.`;
      }
      el.endTitle.className = won ? 'win' : 'lose';
      el.restartBtn.textContent = won && campaignComplete ? 'Play Again' : won ? 'Continue' : 'Retry';
    },
    hideEnd() {
      el.end.classList.add('hidden');
    },
    bindStart(fn) {
      el.startBtn.addEventListener('click', fn);
    },
    bindRestart(fn) {
      el.restartBtn.addEventListener('click', fn);
    },
    bindBoost(fn) {
      el.boostIcon.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        fn();
      });
    },
  };
}
