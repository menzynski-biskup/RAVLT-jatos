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

const INSTRUCTIONS_BY_CODE = {
  A1: 'I am going to read a list of words. Listen carefully, for when I stop you are to repeat back as many words as you can remember. It doesn’t matter in what order you repeat them. Just try to remember as many as you can. Read List A with ~1-second interval between words. Do not give feedback on correct responses, repetitions, or errors.',
  A2: 'Now I am going to read the same words again, and once again when I stop I want you to tell me as many words as you can remember, including words you said just now, at the first trial. It doesn’t matter in what order you say them. Just say as many words as you can remember from the list whether or not you said them already at previous attempts. Repeat this same instruction for Trials 3 through 5.',
  A3: 'Use the Trial 2 instruction and read List A again.',
  A4: 'Use the Trial 2 instruction and read List A again.',
  A5: 'Use the Trial 2 instruction and read List A again.',
  B1: 'Now I’m going to read a second list of words. Listen carefully, for when I stop you are to repeat back as many words as you can remember. It doesn’t matter in what order you repeat them. Just try to remember as many as you can.',
  A6: 'Now tell me all the words that you can remember from the first list.',
  A7: 'A while ago, I read a list of words to you several times, and you had to repeat back the words. Tell me the words from that list.'
};

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
  currentTrialOrder: [],
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
const scoreSheetWrap = document.getElementById('scoreSheetWrap');

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
  appState.currentTrialOrder = [];
  renderWords();
  renderScoreSheet();
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
    recalledWords: [...appState.currentTrialOrder],
    recallOrder: buildRecallOrderMap(appState.currentTrialOrder),
    score: appState.currentTrialOrder.length,
    capturedAt: new Date().toISOString()
  });

  appState.currentTrialOrder = [];
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
  renderScoreSheet();

  if (step.code === 'DELAY') {
    enterDelayStep();
    return;
  }

  delayPanel.classList.add('hidden');
  wordButtons.classList.remove('hidden');
  clearTrialBtn.disabled = false;
  nextTrialBtn.disabled = false;

  phaseInstruction.textContent = getStepInstruction(step.code);

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
  renderScoreSheet();

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
    const orderIndex = appState.currentTrialOrder.indexOf(word);
    const orderNumber = orderIndex >= 0 ? orderIndex + 1 : '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `word-btn${orderNumber ? ' selected' : ''}`;
    button.textContent = orderNumber ? `${word} (${orderNumber})` : word;
    button.addEventListener('click', () => {
      const currentIndex = appState.currentTrialOrder.indexOf(word);
      if (currentIndex >= 0) {
        appState.currentTrialOrder.splice(currentIndex, 1);
      } else {
        appState.currentTrialOrder.push(word);
      }
      renderWords();
      renderScoreSheet();
      updateSelectedCount();
    });
    wordButtons.appendChild(button);
  }
}

function updateSelectedCount() {
  selectedCount.textContent = String(appState.currentTrialOrder.length);
}

function getStepInstruction(code) {
  return (
    INSTRUCTIONS_BY_CODE[code] ||
    'Record recalled words for this trial, then click “Save trial & next”.'
  );
}

function renderScoreSheet() {
  if (!appState.metadata) {
    scoreSheetWrap.innerHTML = '';
    return;
  }

  const trialCodes = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'A6', 'A7'];
  const currentCode = RAVLT_FLOW[appState.flowIndex]?.code;
  const currentTrialMap =
    currentCode && currentCode !== 'DELAY' ? buildRecallOrderMap(appState.currentTrialOrder) : null;

  const trialMaps = Object.fromEntries(
    trialCodes.map((code) => {
      const savedTrial = appState.trials.find((trial) => trial.code === code);
      if (savedTrial) {
        return [code, savedTrial.recallOrder || buildRecallOrderMap(savedTrial.recalledWords || [])];
      }
      if (code === currentCode && currentTrialMap) {
        return [code, currentTrialMap];
      }
      return [code, {}];
    })
  );

  const renderWordRows = (words) =>
    words
      .map((word) => {
        const cells = trialCodes
          .map((code) => {
            const isCurrent = code === currentCode ? ' current-cell' : '';
            const value = trialMaps[code]?.[word] ?? '';
            return `<td class="order-cell${isCurrent}">${value}</td>`;
          })
          .join('');
        return `<tr><td>${word}</td>${cells}</tr>`;
      })
      .join('');

  const aWords = WORD_LISTS[appState.metadata.listVersion].a;
  const bWords = WORD_LISTS[appState.metadata.listVersion].b;
  const sumRow = trialCodes
    .map((code) => `<td class="sum-cell">${Object.keys(trialMaps[code] || {}).length}</td>`)
    .join('');

  scoreSheetWrap.innerHTML = `
    <table class="score-sheet">
      <thead>
        <tr>
          <th>Word</th>
          ${trialCodes.map((code) => `<th>${code}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr class="list-header"><td colspan="${trialCodes.length + 1}">List A words</td></tr>
        ${renderWordRows(aWords)}
        <tr class="list-header"><td colspan="${trialCodes.length + 1}">List B words</td></tr>
        ${renderWordRows(bWords)}
        <tr class="sum-row"><td>SUM</td>${sumRow}</tr>
      </tbody>
    </table>
  `;
}

function buildRecallOrderMap(words) {
  return Object.fromEntries(words.map((word, index) => [word, index + 1]));
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
