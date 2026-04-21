import { fetchRepos } from '../utils/github.js';

let fetchedRepos = [];
let fetchedForUser = '';

const clearNode = (node) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const makeChip = (repo) => {
  const chip = document.createElement('span');
  chip.className = 'repo-chip';

  const dot = document.createElement('span');
  dot.className = 'repo-dot';

  const text = document.createElement('span');
  const language = repo.language ? ` ${repo.language}` : ' Unknown';
  text.textContent = `${repo.name} ·${language}`;

  chip.appendChild(dot);
  chip.appendChild(text);
  return chip;
};

const renderRepos = (repos, refs) => {
  const { reposWrap, repoChips } = refs;
  clearNode(repoChips);

  repos.forEach((repo) => {
    repoChips.appendChild(makeChip(repo));
  });

  if (repos.length > 0) {
    reposWrap.classList.remove('hidden');
  } else {
    reposWrap.classList.add('hidden');
  }
};

export const getFetchedRepos = () => fetchedRepos;

export const getFetchedForUser = () => fetchedForUser;

export const resetFetchedRepos = () => {
  fetchedRepos = [];
  fetchedForUser = '';
};

export const initRepoFetcher = (refs) => {
  const { githubInput, fetchButton, repoError, reposWrap, repoChips } = refs;

  const runFetch = async () => {
    const username = (githubInput.value || '').trim();

    if (!username) {
      repoError.textContent = 'Enter a GitHub username.';
      fetchedRepos = [];
      fetchedForUser = '';
      reposWrap.classList.add('hidden');
      clearNode(repoChips);
      return [];
    }

    repoError.textContent = '';
    const original = fetchButton.textContent;
    fetchButton.disabled = true;
    fetchButton.textContent = 'Fetching...';

    try {
      const repos = await fetchRepos(username);
      fetchedRepos = repos;
      fetchedForUser = username;
      renderRepos(repos, { reposWrap, repoChips });
      return repos;
    } catch (error) {
      fetchedRepos = [];
      fetchedForUser = '';
      reposWrap.classList.add('hidden');
      clearNode(repoChips);
      repoError.textContent = error.message || 'Unable to fetch repositories.';
      return [];
    } finally {
      fetchButton.disabled = false;
      fetchButton.textContent = original;
    }
  };

  fetchButton.addEventListener('click', runFetch);

  return {
    fetchNow: runFetch
  };
};
