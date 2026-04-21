export const fetchRepos = async (username) => {
  const cleaned = (username || '').trim();

  if (!cleaned) {
    throw new Error('GitHub username is required.');
  }

  const endpoint = `https://api.github.com/users/${encodeURIComponent(cleaned)}/repos?sort=updated&per_page=100`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });
  } catch {
    throw new Error('Network error while fetching GitHub repositories.');
  }

  if (response.status === 404) {
    throw new Error('GitHub user not found. Check the username.');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}).`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((repo) => repo && repo.fork !== true)
    .map((repo) => ({
      name: repo.name || '',
      description: repo.description || '',
      language: repo.language || '',
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      stars: Number(repo.stargazers_count || 0)
    }));
};
