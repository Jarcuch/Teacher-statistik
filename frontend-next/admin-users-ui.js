'use strict';

function initializeAdminUi({ applyData, notify, onSessionExpired, isSaving }) {
  const app = document.getElementById('app');
  const panel = document.getElementById('adminPanel');
  const selector = document.getElementById('adminAccount');
  const deleteButton = document.getElementById('adminDeleteData');
  const activeLabel = document.getElementById('adminActiveAccount');
  const form = document.getElementById('adminCreateAccount');
  const usernameInput = document.getElementById('adminNewUsername');
  const passwordInput = document.getElementById('adminNewPassword');
  const confirmInput = document.getElementById('adminConfirmPassword');
  const deleteAccount = document.getElementById('adminDeleteAccount');
  const resetPanel = document.getElementById('resetPasswordPanel');
  const resetForm = document.getElementById('resetPasswordForm');
  function clearResetForm() {
    resetForm.reset();
    resetPanel.open = false;
    resetPanel.hidden = true;
  }
  const accounts = new Map();
  let admin = null;
  let targetId = null;
  let busy = false;

  function updateActiveLabel() {
    activeLabel.textContent = 'Zobrazená data: ' +
      (targetId === null ? admin.username : accounts.get(targetId).username);
    clearResetForm();
    resetPanel.hidden = accounts.get(targetId)?.role !== 'user';
    deleteAccount.disabled = accounts.get(targetId)?.role !== 'user';
  }

  async function refreshUsers(failureMessage = 'Seznam účtů se nepodařilo načíst.') {
    const currentAdmin = admin;
    try {
      const { users } = await teacherApi.listUsers();
      if (admin !== currentAdmin) return;

      if (targetId !== null && !users.some(user => user.id === targetId)) {
        const { data } = await teacherApi.readData();
        if (admin !== currentAdmin) return;
        applyData(data);
        targetId = null;
      }

      accounts.clear();
      selector.replaceChildren(new Option('Moje data', ''));
      for (const account of users) {
        if (account.id === currentAdmin.id) continue;
        accounts.set(account.id, account);
        selector.add(new Option(account.username, String(account.id)));
      }
      selector.value = targetId === null ? '' : String(targetId);
      selector.disabled = false;
      updateActiveLabel();
    } catch (error) {
      if (admin !== currentAdmin) return;
      if (error.status === 401) onSessionExpired();
      else notify(failureMessage);
    }
  }

  async function setUser(user) {
    admin = user?.role === 'admin' ? user : null;
    targetId = null;
    accounts.clear();
    clearResetForm();
    form.reset();
    panel.hidden = !admin;
    selector.replaceChildren(new Option('Moje data', ''));
    selector.disabled = true;
    deleteAccount.disabled = true;
    activeLabel.textContent = '';
    if (!admin) return;

    updateActiveLabel();
    await refreshUsers();
  }

  async function runAction(action, failureMessage) {
    if (!admin || busy || isSaving()) return;

    busy = true;
    app.inert = true;
    try {
      await action();
    } catch (error) {
      if (error.status === 401) onSessionExpired();
      else notify(typeof failureMessage === 'function' ? failureMessage(error) : failureMessage);
    } finally {
      selector.value = targetId === null ? '' : String(targetId);
      app.inert = false;
      busy = false;
    }
  }

  selector.addEventListener('change', () => {
    const nextId = selector.value === '' ? null : Number(selector.value);
    void runAction(async () => {
      const { data } = nextId === null
        ? await teacherApi.readData()
        : await teacherApi.readAccountData(nextId);
      applyData(data);
      targetId = nextId;
      updateActiveLabel();
    }, 'Účet se nepodařilo načíst.');
  });

  deleteButton.addEventListener('click', () => {
    if (!admin || busy || isSaving()) return;

    const username = targetId === null ? admin.username : selector.selectedOptions[0].textContent;
    if (!confirm(`Smazat všechna uložená data účtu ${username}? Účet zůstane zachován.`)) return;

    void runAction(async () => {
      await teacherApi.deleteAccountData(targetId ?? admin.id);
      applyData({});
      notify('Data účtu byla smazána.');
    }, 'Smazání dat se nepodařilo potvrdit.');
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!admin || busy || isSaving()) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (password !== confirmInput.value) {
      notify('Hesla se neshodují.');
      return;
    }

    passwordInput.value = '';
    confirmInput.value = '';
    void runAction(async () => {
      await teacherApi.createUser(username, password);
      form.reset();
      notify('Účet byl vytvořen.');
      await refreshUsers('Účet byl vytvořen, ale seznam se nepodařilo obnovit.');
    }, error => error.status === 409
      ? 'Účet s tímto jménem už existuje nebo chybí oprávnění.'
      : 'Účet se nepodařilo vytvořit. Zkontrolujte jméno a heslo.');
  });

  resetForm.addEventListener('submit', event => {
    event.preventDefault();
    const account = accounts.get(targetId);
    if (!admin || busy || isSaving() || account?.role !== 'user') return;
    const password = document.getElementById('resetPassword').value;
    if (password !== document.getElementById('repeatPassword').value) return notify('Hesla se neshodují.');
    if ([...password].length < 15 || new TextEncoder().encode(password).length > 1024) {
      return notify('Heslo musí mít alespoň 15 znaků a nejvýše 1024 bajtů.');
    }
    if (!confirm('Změnit heslo účtu ' + account.username + ' a odhlásit jeho zařízení?')) return;
    void runAction(async () => {
      await teacherApi.resetPassword(account.id, password);
      updateActiveLabel();
      notify('Heslo účtu ' + account.username + ' bylo změněno.');
    }, 'Heslo se nepodařilo změnit.');
  });

  deleteAccount.addEventListener('click', () => {
    const account = accounts.get(targetId);
    if (!admin || busy || isSaving() || account?.role !== 'user') return;
    if (!confirm('Trvale smazat přihlašovací účet ' + account.username + '?')) return;

    void runAction(async () => {
      const { data } = await teacherApi.readData();
      await teacherApi.deleteUser(account.id);
      accounts.delete(account.id);
      selector.selectedOptions[0]?.remove();
      targetId = null;
      selector.value = '';
      applyData(data);
      updateActiveLabel();
      notify('Účet byl smazán.');
      await refreshUsers('Účet byl smazán, ale seznam se nepodařilo obnovit.');
    }, error => error.status === 409
      ? 'Účet už neexistuje nebo má stále uložená data.'
      : 'Smazání účtu se nepodařilo potvrdit.');
  });

  return { setUser, getTargetId: () => targetId };
}
