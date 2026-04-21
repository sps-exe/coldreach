export const get = (key) => {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const set = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const clear = (key) => {
  localStorage.removeItem(key);
};
