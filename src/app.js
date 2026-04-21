import { get, set } from './utils/storage.js';
import { generateMessages } from './utils/claude.js';
import { initSettings } from './components/settings.js';
import { initRepoFetcher, getFetchedRepos, getFetchedForUser } from './components/repoFetcher.js';
import { renderOutput } from './components/outputRenderer.js';

const KEYS = {
  apiKey: 'cr_api_key',
  github: 'cr_github',
  college: 'cr_college',
  degree: 'cr_degree'
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('outreachForm');

  const senderName = document.getElementById('senderName');
  const githubUsername = document.getElementById('githubUsername');
  const college = document.getElementById('college');
  const degree = document.getElementById('degree');
  const skill = document.getElementById('skill');

  const recipientName = document.getElementById('recipientName');
  const recipientTitle = document.getElementById('recipientTitle');
  const recipientCompany = document.getElementById('recipientCompany');

  const purpose = document.getElementById('purpose');
  const customPurposeWrap = document.getElementById('customPurposeWrap');
  const customPurpose = document.getElementById('customPurpose');
  const context = document.getElementById('context');
  const extraNotes = document.getElementById('extraNotes');

  const platformToggle = document.getElementById('platformToggle');
  const generateBtn = document.getElementById('generateBtn');
  const regenerateBtn = document.getElementById('regenerateBtn');

  const apiKeyWarning = document.getElementById('apiKeyWarning');
  const globalError = document.getElementById('globalError');
  const outputSection = document.getElementById('outputSection');

  const fetchReposBtn = document.getElementById('fetchReposBtn');
  const repoError = document.getElementById('repoError');
  const reposWrap = document.getElementById('reposWrap');
  const repoChips = document.getElementById('repoChips');

  let platform = 'LinkedIn DM';
  let lastPayload = null;

  const setLoading = (isLoading) => {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? 'Generating...' : 'Generate messages';

    regenerateBtn.disabled = isLoading;
    regenerateBtn.textContent = isLoading ? 'Regenerating...' : 'Regenerate';
  };

  const clearErrors = () => {
    apiKeyWarning.textContent = '';
    globalError.textContent = '';
  };

  const updatePurposeVisibility = () => {
    if (purpose.value === 'Custom...') {
      customPurposeWrap.classList.remove('hidden');
      return;
    }

    customPurposeWrap.classList.add('hidden');
    customPurpose.value = '';
  };

  const setPlatform = (nextPlatform) => {
    platform = nextPlatform;
    const buttons = platformToggle.querySelectorAll('.toggle-btn');

    buttons.forEach((button) => {
      const isActive = button.dataset.platform === nextPlatform;
      button.classList.toggle('active', isActive);
    });
  };

  const loadSavedValues = () => {
    const savedGithub = get(KEYS.github) || '';
    const savedCollege = get(KEYS.college) || 'Rishihood University';
    const savedDegree = get(KEYS.degree) || 'B.Tech CS & AI';

    githubUsername.value = savedGithub;
    college.value = savedCollege;
    degree.value = savedDegree;
  };

  const buildPayload = () => {
    const selectedPurpose = purpose.value === 'Custom...'
      ? (customPurpose.value || '').trim()
      : purpose.value;

    return {
      apiKey: get(KEYS.apiKey) || '',
      senderName: (senderName.value || '').trim(),
      college: (college.value || '').trim(),
      degree: (degree.value || '').trim(),
      skill: (skill.value || '').trim(),
      repos: getFetchedRepos(),
      recipientName: (recipientName.value || '').trim(),
      recipientTitle: (recipientTitle.value || '').trim(),
      recipientCompany: (recipientCompany.value || '').trim(),
      purpose: selectedPurpose,
      platform,
      context: (context.value || '').trim(),
      extraNotes: (extraNotes.value || '').trim()
    };
  };

  const validatePayload = (payload) => {
    if (!payload.apiKey) {
      apiKeyWarning.textContent = 'Add your Anthropic API key in settings to generate messages.';
      return false;
    }

    const requiredText = [
      payload.senderName,
      payload.skill,
      payload.recipientName,
      payload.recipientTitle,
      payload.recipientCompany,
      payload.purpose
    ];

    if (requiredText.some((value) => !value)) {
      globalError.textContent = 'Please fill all required fields before generating.';
      return false;
    }

    return true;
  };

  const runGeneration = async () => {
    clearErrors();

    set(KEYS.github, (githubUsername.value || '').trim());
    set(KEYS.college, (college.value || '').trim() || 'Rishihood University');
    set(KEYS.degree, (degree.value || '').trim() || 'B.Tech CS & AI');

    const payload = buildPayload();

    if (!validatePayload(payload)) {
      return;
    }

    const currentGithub = (githubUsername.value || '').trim();
    if (currentGithub && getFetchedRepos().length && getFetchedForUser() !== currentGithub) {
      repoError.textContent = 'GitHub username changed. Fetch repos again to refresh project context.';
    }

    setLoading(true);

    try {
      const data = await generateMessages(payload);
      renderOutput(data);
      lastPayload = payload;
      outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      globalError.textContent = error.message || 'Failed to generate messages.';
    } finally {
      setLoading(false);
    }
  };

  initSettings({
    onApply: ({ github, college: savedCollege, degree: savedDegree }) => {
      githubUsername.value = github;
      college.value = savedCollege;
      degree.value = savedDegree;
    }
  });

  initRepoFetcher({
    githubInput: githubUsername,
    fetchButton: fetchReposBtn,
    repoError,
    reposWrap,
    repoChips
  });

  platformToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.toggle-btn');
    if (!button) {
      return;
    }

    setPlatform(button.dataset.platform || 'LinkedIn DM');
  });

  purpose.addEventListener('change', updatePurposeVisibility);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runGeneration();
  });

  regenerateBtn.addEventListener('click', async () => {
    if (!lastPayload) {
      await runGeneration();
      return;
    }

    clearErrors();
    setLoading(true);

    try {
      const payload = buildPayload();
      if (!validatePayload(payload)) {
        return;
      }

      const data = await generateMessages(payload);
      renderOutput(data);
      lastPayload = payload;
      outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      globalError.textContent = error.message || 'Failed to regenerate messages.';
    } finally {
      setLoading(false);
    }
  });

  loadSavedValues();
  updatePurposeVisibility();
  setPlatform('LinkedIn DM');
});
