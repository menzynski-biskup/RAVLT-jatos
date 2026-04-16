const WORD_LISTS = {
  v1: {
    a: [
      'drum',
      'curtain',
      'bell',
      'coffee',
      'school',
      'parent',
      'moon',
      'garden',
      'hat',
      'farmer',
      'nose',
      'turkey',
      'color',
      'house',
      'river'
    ],
    b: [
      'desk',
      'sun',
      'chair',
      'bird',
      'shoe',
      'mountain',
      'bread',
      'dog',
      'window',
      'tree',
      'book',
      'carpet',
      'ocean',
      'apple',
      'clock'
    ]
  },
  v2: {
    a: [
      'engine',
      'leaf',
      'picture',
      'salt',
      'market',
      'pocket',
      'window',
      'doctor',
      'singer',
      'village',
      'butter',
      'pillow',
      'bridge',
      'candle',
      'forest'
    ],
    b: [
      'hammer',
      'orange',
      'button',
      'mirror',
      'station',
      'pencil',
      'basket',
      'cloud',
      'thunder',
      'wallet',
      'rabbit',
      'planet',
      'camera',
      'island',
      'ticket'
    ]
  }
};

const RAVLT_FLOW = [
  { code: 'A1', list: 'a', label: 'List A - Trial 1' },
  { code: 'A2', list: 'a', label: 'List A - Trial 2' },
  { code: 'A3', list: 'a', label: 'List A - Trial 3' },
  { code: 'A4', list: 'a', label: 'List A - Trial 4' },
  { code: 'A5', list: 'a', label: 'List A - Trial 5' },
  { code: 'B1', list: 'b', label: 'Interference List B' },
  { code: 'A6', list: 'a', label: 'Immediate Recall (List A after interference)' },
  { code: 'DELAY', list: null, label: 'Delay period' },
  { code: 'A7', list: 'a', label: 'Delayed Recall (List A)' }
];

const CSV_COLUMNS = [
  { header: 'participantId', getValue: (payload, trial) => payload.participant.participantId },
  { header: 'group', getValue: (payload, trial) => payload.participant.group },
  { header: 'session', getValue: (payload, trial) => payload.participant.session },
  { header: 'timeOfDay', getValue: (payload, trial) => payload.participant.timeOfDay },
  { header: 'listVersion', getValue: (payload, trial) => payload.participant.listVersion },
  { header: 'code', getValue: (payload, trial) => trial.code },
  { header: 'label', getValue: (payload, trial) => trial.label },
  { header: 'score', getValue: (payload, trial) => trial.score },
  { header: 'delayDurationSeconds', getValue: (payload, trial) => trial.delayDurationSeconds ?? '' },
  { header: 'recalledWords', getValue: (payload, trial) => trial.recalledWords.join('|') },
  { header: 'capturedAt', getValue: (payload, trial) => trial.capturedAt }
];

const appState = {
  metadata: null,
  startedAt: null,
  finishedAt: null,
  flowIndex: 0,
  selectedWords: new Set(),
  trials: [],
  delayStartedAt: null,
  delayStoppedAt: null,
  delayTimerId: null
};

const setupSection = document.getElementById('setupSection');
const setupForm = document.getElementById('setupForm');
const assessmentSection = document.getElementById('assessmentSection');
const summarySection = document.getElementById('summarySection');
const phaseTitle = document.getElementById('phaseTitle');
const trialCounter = document.getElementById('trialCounter');
const phaseInstruction = document.getElementById('phaseInstruction');
const wordButtons = document.getElementById('wordButtons');
const delayPanel = document.getElementById('delayPanel');
const delayTimer = document.getElementById('delayTimer');
const startDelayedRecallBtn = document.getElementById('startDelayedRecallBtn');
const selectedCount = document.getElementById('selectedCount');
const clearTrialBtn = document.getElementById('clearTrialBtn');
const nextTrialBtn = document.getElementById('nextTrialBtn');
const summaryMeta = document.getElementById('summaryMeta');
const submissionStatus = document.getElementById('submissionStatus');
const summaryTableWrap = document.getElementById('summaryTableWrap');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(setupForm);
  appState.metadata = {
    participantId: String(formData.get('participantId') || '').trim(),
    group: String(formData.get('group') || '').trim(),
    session: String(formData.get('session') || '').trim(),
    timeOfDay: String(formData.get('timeOfDay') || '').trim(),
    listVersion: String(formData.get('listVersion') || '').trim()
  };

  if (!appState.metadata.participantId || !appState.metadata.group || !appState.metadata.session || !appState.metadata.timeOfDay || !appState.metadata.listVersion) {
    return;
  }

  appState.startedAt = new Date().toISOString();
  setupSection.classList.add('hidden');
  assessmentSection.classList.remove('hidden');
  renderCurrentStep();
});

clearTrialBtn.addEventListener('click', () => {
  appState.selectedWords.clear();
  renderWords();
  updateSelectedCount();
});

nextTrialBtn.addEventListener('click', () => {
  const step = RAVLT_FLOW[appState.flowIndex];
  if (!step || step.code === 'DELAY') {
    return;
  }

  appState.trials.push({
    code: step.code,
    label: step.label,
    listType: step.list,
    recalledWords: [...appState.selectedWords],
    score: appState.selectedWords.size,
    capturedAt: new Date().toISOString()
  });

  appState.selectedWords.clear();
  appState.flowIndex += 1;
  renderCurrentStep();
});

startDelayedRecallBtn.addEventListener('click', () => {
  if (!appState.delayStartedAt || appState.delayStoppedAt) {
    return;
  }
  appState.delayStoppedAt = new Date().toISOString();
  stopDelayTimer();

  appState.trials.push({
    code: 'DELAY',
    label: 'Delay period',
    listType: null,
    recalledWords: [],
    score: 0,
    capturedAt: appState.delayStoppedAt,
    delayDurationSeconds: getDelayDurationSeconds()
  });

  appState.flowIndex += 1;
  renderCurrentStep();
});

downloadJsonBtn.addEventListener('click', () => {
  downloadFile(
    `${getFilePrefix()}.json`,
    JSON.stringify(getResultPayload(), null, 2),
    'application/json'
  );
});

downloadCsvBtn.addEventListener('click', () => {
  downloadFile(`${getFilePrefix()}.csv`, toCsv(getResultPayload()), 'text/csv;charset=utf-8');
});

function renderCurrentStep() {
  const step = RAVLT_FLOW[appState.flowIndex];
  if (!step) {
    finishAssessment();
    return;
  }

  trialCounter.textContent = `Step ${appState.flowIndex + 1} / ${RAVLT_FLOW.length}`;
  phaseTitle.textContent = step.label;

  if (step.code === 'DELAY') {
    enterDelayStep();
    return;
  }

  delayPanel.classList.add('hidden');
  wordButtons.classList.remove('hidden');
  clearTrialBtn.disabled = false;
  nextTrialBtn.disabled = false;

  phaseInstruction.textContent =
    'Read the list aloud, then click each recalled word as the participant answers. Click “Save trial & next” when done.';

  renderWords();
  updateSelectedCount();
}

function enterDelayStep() {
  wordButtons.classList.add('hidden');
  clearTrialBtn.disabled = true;
  nextTrialBtn.disabled = true;
  delayPanel.classList.remove('hidden');
  phaseInstruction.textContent =
    'Keep this page open while the participant performs other tasks. Click “Start delayed recall” when they return.';

  appState.delayStartedAt = new Date().toISOString();
  appState.delayStoppedAt = null;
  delayTimer.textContent = '00:00';
  stopDelayTimer();
  appState.delayTimerId = setInterval(() => {
    delayTimer.textContent = formatDuration(getDelayDurationSeconds());
  }, 1000);
}

function renderWords() {
  const step = RAVLT_FLOW[appState.flowIndex];
  if (!step || !step.list || !appState.metadata) {
    return;
  }
  const words = WORD_LISTS[appState.metadata.listVersion][step.list];
  wordButtons.innerHTML = '';

  for (const word of words) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `word-btn${appState.selectedWords.has(word) ? ' selected' : ''}`;
    button.textContent = word;
    button.addEventListener('click', () => {
      if (appState.selectedWords.has(word)) {
        appState.selectedWords.delete(word);
      } else {
        appState.selectedWords.add(word);
      }
      button.classList.toggle('selected');
      updateSelectedCount();
    });
    wordButtons.appendChild(button);
  }
}

function updateSelectedCount() {
  selectedCount.textContent = String(appState.selectedWords.size);
}

function stopDelayTimer() {
  if (appState.delayTimerId) {
    clearInterval(appState.delayTimerId);
    appState.delayTimerId = null;
  }
}

function getDelayDurationSeconds() {
  if (!appState.delayStartedAt) {
    return 0;
  }
  const start = new Date(appState.delayStartedAt).getTime();
  const end = new Date(appState.delayStoppedAt || new Date().toISOString()).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function finishAssessment() {
  appState.finishedAt = new Date().toISOString();
  assessmentSection.classList.add('hidden');
  summarySection.classList.remove('hidden');

  const payload = getResultPayload();
  summaryMeta.textContent = `Participant ${payload.participant.participantId}, list ${payload.participant.listVersion}, completed ${new Date(payload.finishedAt).toLocaleString()}.`;
  renderSummaryTable(payload.trials);
  submissionStatus.textContent = '';

  if (window.jatos && typeof window.jatos.submitResultData === 'function') {
    try {
      window.jatos.submitResultData(
        JSON.stringify(payload),
        () => {
          submissionStatus.textContent = 'JATOS submission succeeded.';
        },
        () => {
          submissionStatus.textContent = 'JATOS submission failed. Please export JSON/CSV as backup.';
        }
      );
    } catch (error) {
      submissionStatus.textContent = 'JATOS submission failed. Please export JSON/CSV as backup.';
    }
  }
}

function renderSummaryTable(trials) {
  const rows = trials
    .map(
      (trial) =>
        `<tr><td>${trial.code}</td><td>${trial.label}</td><td>${trial.score}</td><td>${
          trial.delayDurationSeconds ?? ''
        }</td><td>${trial.recalledWords.join('; ')}</td></tr>`
    )
    .join('');

  summaryTableWrap.innerHTML = `<table><thead><tr><th>Code</th><th>Trial</th><th>Score</th><th>Delay (s)</th><th>Recalled words</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function getResultPayload() {
  return {
    participant: appState.metadata,
    startedAt: appState.startedAt,
    finishedAt: appState.finishedAt,
    trials: appState.trials
  };
}

function toCsv(payload) {
  const header = CSV_COLUMNS.map((column) => column.header);
  const rows = payload.trials.map((trial) =>
    CSV_COLUMNS.map((column) => column.getValue(payload, trial))
  );

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getFilePrefix() {
  const id = appState.metadata?.participantId || 'participant';
  return `${id}-ravlt-${formatTimestampForFilename(new Date())}`;
}

function formatTimestampForFilename(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}
