'use strict';

const teacherApi = (() => {
  const baseUrl = new URL("./", document.currentScript.src);
  async function request(path, method = 'GET', payload) {
    const options = {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    };

    if (payload !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(new URL(path.slice(1), baseUrl), options);
    if (!response.ok) {
      const error = new Error(`Požadavek selhal (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return;
    return response.json();
  }

  function accountDataPath(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Neplatné ID účtu.');
    return `/admin/users/${id}/data`;
  }

  return Object.freeze({
    listUsers: () => request('/admin/users'),
    createUser: (username, password) => request('/admin/users', 'POST', { username, password }),
    resetPassword: (id, password) => request(`/admin/users/${id}/password`, 'PUT', { password }),
    deleteUser: id => request(accountDataPath(id).slice(0, -'/data'.length), 'DELETE'),
    readAccountData: id => request(accountDataPath(id)),
    saveAccountData: (id, data) => request(accountDataPath(id), 'PUT', { data }),
    deleteAccountData: id => request(accountDataPath(id), 'DELETE'),
    login: (username, password) => request('/login', 'POST', { username, password }),
    getProfile: () => request('/me'),
    logout: () => request('/logout', 'POST'),
    readData: () => request('/data'),
    saveData: data => request('/data', 'PUT', { data }),
  });
})();
