import { get, set } from './utils/storage.js';
import { analyzeOpportunity, generateMessages } from './utils/claude.js';
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
  const opportunityText = document.getElementById('opportunityText');
  const analyzeOpportunityBtn = document.getElementById('analyzeOpportunityBtn');
  const analysisStatus = document.getElementById('analysisStatus');
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
  let opportunityAnalysis = null;

  const PURPOSE_MAP = {
    'job / internship': 'Job / Internship',
    'youtube collaboration': 'YouTube Collaboration',
    'mentorship & advice': 'Mentorship & Advice',
    'freelance project': 'Freelance Project',
    'podcast / interview': 'Podcast / Interview',
    'research opportunity': 'Research Opportunity',
    networking: 'Networking'
  };

  const parseWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean);

  const startsWithBlockedLine = (message) => {
    const firstLine = (message || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
    return /^(I\b|My name is\b|I hope this\b)/i.test(firstLine);
  };

  const countCtas = (message) => {
    const ctaMarkers = [
      /15[- ]?min(?:ute)?/gi,
      /voice note/gi,
      /quick reply/gi,
      /quick response/gi,
      /open to a call/gi,
      /would you be open/gi,
      /could we schedule/gi,
      /can we (?:do|set up)/gi
    ];

    return ctaMarkers.reduce((total, regex) => total + ((message || '').match(regex) || []).length, 0);
  };

  const buzzwordsRegex = /\b(synergy|circle back|touch base|leverage|game-changer|reach out)\b/i;

  const validateGeneratedOutput = (data, currentPlatform) => {
    const results = [];
    const versions = Array.isArray(data?.versions) ? data.versions : [];
    const maxWords = currentPlatform === 'Email' ? 120 : 80;
    let passCount = 0;

    versions.forEach((version) => {
      const issues = [];
      const subjectWords = parseWords(version.subject || '').length;
      const messageWords = parseWords(version.message || '').length;

      if (subjectWords >= 7) {
        issues.push('subject too long');
      }
      if (messageWords > maxWords) {
        issues.push(`message exceeds ${maxWords} words`);
      }
      if (startsWithBlockedLine(version.message || '')) {
        issues.push('first line starts with blocked phrase');
      }
      if (buzzwordsRegex.test(version.message || '') || buzzwordsRegex.test(version.subject || '')) {
        issues.push('contains banned buzzword');
      }

      const ctas = countCtas(version.message || '');
      if (ctas === 0) {
        issues.push('no clear CTA detected');
      }
      if (ctas > 1) {
        issues.push('multiple CTA signals detected');
      }

      if (issues.length === 0) {
        passCount += 1;
        results.push(`${version.label}: Pass`);
      } else {
        results.push(`${version.label}: ${issues.join(', ')}`);
      }
    });

    return {
      allPassed: versions.length > 0 && passCount === versions.length,
      checks: results
    };
  };

  const normalizePurposeForSelect = (value) => {
    const key = (value || '').trim().toLowerCase();
    return PURPOSE_MAP[key] || null;
  };

  const repoText = (repo) => `${repo.name || ''} ${repo.description || ''} ${repo.language || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();

  const rankRepos = (repos, { keywords = [], purposeText = '', skillText = '', recipientContext = '' }) => {
    const terms = [
      ...keywords,
      ...(purposeText || '').split(/[^a-zA-Z0-9+#.]+/),
      ...(skillText || '').split(/[^a-zA-Z0-9+#.]+/),
      ...(recipientContext || '').split(/[^a-zA-Z0-9+#.]+/)
    ]
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 3);

    const uniqueTerms = [...new Set(terms)];

    return [...repos]
      .map((repo) => {
        const text = repoText(repo);
        const matches = uniqueTerms.filter((term) => text.includes(term)).length;
        const recencyBoost = 1;
        const starsBoost = Math.min(5, Number(repo.stars || 0));
        const languageBoost = skillText && (repo.language || '').toLowerCase().includes((skillText || '').toLowerCase()) ? 2 : 0;
        const score = matches * 3 + recencyBoost + starsBoost + languageBoost;

        return {
          ...repo,
          fit_score: score,
          fit_reason: matches > 0
            ? `Matches ${matches} context keywords and aligns with ${skillText || 'target skill'}.`
            : 'Chosen for overall portfolio fit and repo quality signals.'
        };
      })
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 3);
  };

  const setLoading = (isLoading) => {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? 'Generating...' : 'Generate messages';

    regenerateBtn.disabled = isLoading;
    regenerateBtn.textContent = isLoading ? 'Regenerating...' : 'Regenerate';
  };

  const clearErrors = () => {
    apiKeyWarning.textContent = '';
    globalError.textContent = '';
    analysisStatus.textContent = '';
    analysisStatus.className = 'field-feedback';
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

  const setPurposeFromSuggestion = (suggestedPurpose) => {
    const normalized = normalizePurposeForSelect(suggestedPurpose);
    if (normalized) {
      purpose.value = normalized;
      updatePurposeVisibility();
      return;
    }

    if ((suggestedPurpose || '').trim()) {
      purpose.value = 'Custom...';
      updatePurposeVisibility();
      customPurpose.value = suggestedPurpose.trim();
    }
  };

  const setPlatformFromSuggestion = (suggestedPlatform) => {
    const normalized = (suggestedPlatform || '').toLowerCase();
    if (normalized.includes('email')) {
      setPlatform('Email');
      return;
    }

    if (normalized.includes('linkedin')) {
      setPlatform('LinkedIn DM');
    }
  };

  const buildPayload = () => {
    const selectedPurpose = purpose.value === 'Custom...'
      ? (customPurpose.value || '').trim()
      : purpose.value;

    const rankedTopRepos = rankRepos(getFetchedRepos(), {
      keywords: opportunityAnalysis?.repo_focus_keywords || opportunityAnalysis?.keywords || [],
      purposeText: selectedPurpose,
      skillText: (skill.value || '').trim(),
      recipientContext: `${(recipientTitle.value || '').trim()} ${(recipientCompany.value || '').trim()}`
    });

    return {
      apiKey: get(KEYS.apiKey) || '',
      senderName: (senderName.value || '').trim(),
      college: (college.value || '').trim(),
      degree: (degree.value || '').trim(),
      skill: (skill.value || '').trim(),
      repos: getFetchedRepos(),
      rankedRepos: rankedTopRepos,
      recipientName: (recipientName.value || '').trim(),
      recipientTitle: (recipientTitle.value || '').trim(),
      recipientCompany: (recipientCompany.value || '').trim(),
      purpose: selectedPurpose,
      platform,
      context: (context.value || '').trim(),
      extraNotes: (extraNotes.value || '').trim(),
      opportunityAnalysis
    };
  };

  const validatePayload = (payload) => {
    if (!payload.apiKey) {
      apiKeyWarning.textContent = 'Add your Gemini API key in settings to generate messages.';
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
      let data = null;
      let checks = { allPassed: false, checks: [] };

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        data = await generateMessages({
          ...payload,
          validationAttempt: attempt,
          previousQualityIssues: checks.checks
        });

        checks = validateGeneratedOutput(data, platform);
        if (checks.allPassed || attempt === 2) {
          break;
        }
      }

      data.quality_checks = checks.checks;
      renderOutput(data);
      lastPayload = payload;
      outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      globalError.textContent = error.message || 'Failed to generate messages.';
    } finally {
      setLoading(false);
    }
  };

  const runOpportunityAnalysis = async () => {
    clearErrors();

    const apiKey = get(KEYS.apiKey) || '';
    if (!apiKey) {
      analysisStatus.textContent = 'Add your Gemini API key in settings first.';
      analysisStatus.className = 'field-feedback warn';
      return;
    }

    const text = (opportunityText.value || '').trim();
    if (!text) {
      analysisStatus.textContent = 'Paste a job post or opportunity brief to analyze.';
      analysisStatus.className = 'field-feedback warn';
      return;
    }

    const original = analyzeOpportunityBtn.textContent;
    analyzeOpportunityBtn.disabled = true;
    analyzeOpportunityBtn.textContent = 'Analyzing...';

    try {
      const result = await analyzeOpportunity({
        apiKey,
        opportunityText: text,
        purpose: purpose.value,
        platform
      });

      opportunityAnalysis = result;

      if (result.suggested_skill && !skill.value.trim()) {
        skill.value = result.suggested_skill;
      }

      if (result.recipient_title && !recipientTitle.value.trim()) {
        recipientTitle.value = result.recipient_title;
      }

      if (result.recipient_company && !recipientCompany.value.trim()) {
        recipientCompany.value = result.recipient_company;
      }

      if (result.context_clue && !context.value.trim()) {
        context.value = result.context_clue;
      }

      if (result.extra_notes) {
        const currentNotes = extraNotes.value.trim();
        extraNotes.value = currentNotes
          ? `${currentNotes}\n${result.extra_notes}`
          : result.extra_notes;
      }

      setPurposeFromSuggestion(result.suggested_purpose);
      setPlatformFromSuggestion(result.suggested_platform);

      analysisStatus.textContent = 'Analysis complete. Suggested fields were auto-filled.';
      analysisStatus.className = 'field-feedback success';
    } catch (error) {
      analysisStatus.textContent = error.message || 'Failed to analyze opportunity text.';
      analysisStatus.className = 'field-feedback error';
    } finally {
      analyzeOpportunityBtn.disabled = false;
      analyzeOpportunityBtn.textContent = original;
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

  analyzeOpportunityBtn.addEventListener('click', runOpportunityAnalysis);

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

      let data = null;
      let checks = { allPassed: false, checks: [] };

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        data = await generateMessages({
          ...payload,
          validationAttempt: attempt,
          previousQualityIssues: checks.checks
        });

        checks = validateGeneratedOutput(data, platform);
        if (checks.allPassed || attempt === 2) {
          break;
        }
      }

      data.quality_checks = checks.checks;
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
