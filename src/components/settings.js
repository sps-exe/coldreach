import { get, set } from '../utils/storage.js';

const KEYS = {
  apiKey: 'cr_api_key',
  github: 'cr_github',
  college: 'cr_college',
  degree: 'cr_degree'
};

export const initSettings = ({ onApply } = {}) => {
  const trigger = document.getElementById('settingsTrigger');
  const overlay = document.getElementById('settingsOverlay');
  const panel = document.getElementById('settingsPanel');
  const close = document.getElementById('settingsClose');
  const save = document.getElementById('settingsSave');

  const apiKeyInput = document.getElementById('settingsApiKey');
  const githubInput = document.getElementById('settingsGithub');
  const collegeInput = document.getElementById('settingsCollege');
  const degreeInput = document.getElementById('settingsDegree');

  const openPanel = () => {
    apiKeyInput.value = get(KEYS.apiKey) || '';
    githubInput.value = get(KEYS.github) || '';
    collegeInput.value = get(KEYS.college) || 'Rishihood University';
    degreeInput.value = get(KEYS.degree) || 'B.Tech CS & AI';

    overlay.classList.remove('hidden');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  };

  const closePanel = () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    overlay.classList.add('hidden');
  };

  const saveSettings = () => {
    set(KEYS.apiKey, apiKeyInput.value.trim());
    set(KEYS.github, githubInput.value.trim());
    set(KEYS.college, (collegeInput.value || '').trim() || 'Rishihood University');
    set(KEYS.degree, (degreeInput.value || '').trim() || 'B.Tech CS & AI');

    const previous = save.textContent;
    save.textContent = 'Saved';

    if (typeof onApply === 'function') {
      onApply({
        apiKey: get(KEYS.apiKey) || '',
        github: get(KEYS.github) || '',
        college: get(KEYS.college) || 'Rishihood University',
        degree: get(KEYS.degree) || 'B.Tech CS & AI'
      });
    }

    setTimeout(() => {
      save.textContent = previous;
      closePanel();
    }, 650);
  };

  trigger.addEventListener('click', openPanel);
  close.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  save.addEventListener('click', saveSettings);
};
