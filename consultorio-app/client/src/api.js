const Api = (() => {
  let baseUrl = '';
  let token = localStorage.getItem('token') || '';

  function setBaseUrl(url) {
    baseUrl = url.replace(/\/+$/, '');
  }

  function setToken(t) {
    token = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  }

  function getToken() {
    return token;
  }

  async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function healthCheck(url) {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/health`, { method: 'GET' });
    if (!res.ok) throw new Error('El servidor no respondio correctamente');
    return true;
  }

  return {
    setBaseUrl,
    setToken,
    getToken,
    healthCheck,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
  };
})();
