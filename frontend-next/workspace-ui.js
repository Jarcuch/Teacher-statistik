'use strict';

function initializeAccountUi({ applyData, clearData, notify, isSaving, onUserChanged }) {
  const byId = id => document.getElementById(id);
  const app = byId('app');
  const gate = byId('accountGate');
  const form = byId('accountForm');
  const username = byId('accountUsername');
  const password = byId('accountPassword');
  const signIn = byId('accountSignIn');
  const signOut = byId('accountSignOut');
  const identity = byId('accountIdentity');
  const message = byId('accountMessage');

  function showSignedOut(text = '') {
    app.hidden = true;
    identity.textContent = '';
    password.value = '';
    onUserChanged(null);
    clearData();
    message.textContent = text;
    gate.hidden = false;
    username.focus();
  }

  async function showAccount(user) {
    const { data } = await teacherApi.readData();
    applyData(data);
    identity.textContent = user.username;
    message.textContent = '';
    gate.hidden = true;
    app.hidden = false;
    onUserChanged(user);
  }

  async function restoreSession() {
    message.textContent = 'Ověřuji přihlášení…';
    try {
      const { user } = await teacherApi.getProfile();
      await showAccount(user);
    } catch (error) {
      showSignedOut(error.status === 401 ? '' : 'Účet se nepodařilo načíst.');
    } finally {
      signIn.disabled = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (signIn.disabled) return;

    signIn.disabled = true;
    message.textContent = 'Přihlašuji…';
    const enteredPassword = password.value;
    password.value = '';

    try {
      const { user } = await teacherApi.login(username.value.trim(), enteredPassword);
      await showAccount(user);
    } catch (error) {
      showSignedOut(error.status === 401
        ? 'Přihlášení se nezdařilo. Zkontrolujte jméno a heslo.'
        : 'Přihlášení nebo načtení dat se nezdařilo. Zkuste to znovu.');
    } finally {
      signIn.disabled = false;
    }
  });

  signOut.addEventListener('click', async () => {
    if (isSaving()) {
      notify('Počkejte, až se dokončí ukládání.');
      return;
    }

    signOut.disabled = true;
    app.inert = true;
    try {
      await teacherApi.logout();
      showSignedOut();
    } catch {
      notify('Odhlášení se nepodařilo. Zkuste to znovu.');
    } finally {
      app.inert = false;
      signOut.disabled = false;
    }
  });

  void restoreSession();
  return {
    expire: () => showSignedOut('Platnost přihlášení vypršela. Přihlaste se znovu.'),
  };
}

function initializeDataUi({ saveData, applySavedData, onSessionExpired, notify }) {
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  let saving = false;

  async function save(nextData) {
    if (saving) return false;

    saving = true;
    app.inert = true;
    modal.inert = true;

    try {
      await saveData(nextData);
    } catch (error) {
      if (error.status === 401) {
        onSessionExpired();
      } else if (error.status === 413) {
        notify('Data přesahují limit 5 MiB.');
      } else {
        notify('Uložení se nepodařilo potvrdit. Zkuste to znovu.');
      }
      return false;
    } finally {
      saving = false;
      app.inert = false;
      modal.inert = false;
    }

    applySavedData(nextData);
    return true;
  }

  return { save, isSaving: () => saving };
}
