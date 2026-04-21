const outputSection = document.getElementById('outputSection');
const repoBanner = document.getElementById('repoBanner');
const messageCards = document.getElementById('messageCards');
const tipsList = document.getElementById('tipsList');
const warningsList = document.getElementById('warningsList');
const qaList = document.getElementById('qaList');
const followUpsWrap = document.getElementById('followUpsWrap');
const followUpsList = document.getElementById('followUpsList');

const clearNode = (node) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const escapeText = (value) => (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const copyText = async (text, button) => {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 900);
  } catch {
    button.textContent = 'Copy failed';
    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  }
};

const createMessageCard = (version) => {
  const card = document.createElement('article');
  card.className = 'message-card';

  const safeLabel = escapeText(version.label || 'Version');
  const safeSubject = escapeText(version.subject || '');
  const safeMessage = escapeText(version.message || '');
  const safeWhy = escapeText(version.why_it_works || '');

  card.innerHTML = `
    <span class="version-badge">${safeLabel}</span>
    <div class="subject-row">
      <p class="subject-text">${safeSubject}</p>
      <button type="button" class="button ghost-sm subject-copy">Copy</button>
    </div>
    <hr class="card-divider" />
    <p class="message-body">${safeMessage}</p>
    <button type="button" class="button ghost">Copy subject + message</button>
    <div class="why-toggle">
      <button type="button" class="why-header">Why this works</button>
      <div class="why-content">${safeWhy}</div>
    </div>
  `;

  const [subjectCopyButton, fullCopyButton] = card.querySelectorAll('button.button');
  const whyToggle = card.querySelector('.why-toggle');
  const whyHeader = card.querySelector('.why-header');

  subjectCopyButton.addEventListener('click', () => {
    copyText(version.subject || '', subjectCopyButton);
  });

  fullCopyButton.addEventListener('click', () => {
    const combined = `${version.subject || ''}\n${version.message || ''}`;
    copyText(combined, fullCopyButton);
  });

  whyHeader.addEventListener('click', () => {
    whyToggle.classList.toggle('open');
  });

  return card;
};

export const renderOutput = (data) => {
  const chosenName = data?.chosen_repo?.name || '';
  const chosenReason = data?.chosen_repo?.reason || '';

  if (chosenName) {
    repoBanner.innerHTML = `<span aria-hidden="true">🐙</span><span>Best project picked: ${escapeText(chosenName)} — ${escapeText(chosenReason)}</span>`;
  } else {
    repoBanner.innerHTML = '<span aria-hidden="true">🐙</span><span>Best project picked: None — No repository selected.</span>';
  }

  clearNode(messageCards);
  const versions = Array.isArray(data?.versions) ? data.versions : [];
  versions.forEach((version) => {
    messageCards.appendChild(createMessageCard(version));
  });

  clearNode(tipsList);
  const tips = Array.isArray(data?.personalization_tips) ? data.personalization_tips : [];
  tips.forEach((tip) => {
    const item = document.createElement('li');
    item.textContent = tip;
    tipsList.appendChild(item);
  });

  clearNode(warningsList);
  const warnings = Array.isArray(data?.avoid) ? data.avoid : [];
  warnings.forEach((warning) => {
    const item = document.createElement('li');
    item.textContent = warning;
    warningsList.appendChild(item);
  });

  clearNode(followUpsList);
  const followUps = Array.isArray(data?.follow_ups) ? data.follow_ups : [];
  if (followUps.length) {
    followUpsWrap.classList.remove('hidden');
    followUps.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'followup-item';

      const label = document.createElement('p');
      label.className = 'followup-label';
      label.textContent = entry.label || 'Follow-up';

      const body = document.createElement('p');
      body.className = 'followup-body';
      body.textContent = entry.message || '';

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'button ghost-sm';
      copy.textContent = 'Copy follow-up';
      copy.addEventListener('click', () => {
        copyText(entry.message || '', copy);
      });

      item.appendChild(label);
      item.appendChild(body);
      item.appendChild(copy);
      followUpsList.appendChild(item);
    });
  } else {
    followUpsWrap.classList.add('hidden');
  }

  clearNode(qaList);
  const qualityChecks = Array.isArray(data?.quality_checks) ? data.quality_checks : [];
  qualityChecks.forEach((result) => {
    const item = document.createElement('li');
    item.textContent = result;
    qaList.appendChild(item);
  });

  outputSection.classList.remove('hidden');
  requestAnimationFrame(() => {
    outputSection.classList.add('show');
  });
};
