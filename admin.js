const $ = (id) => document.getElementById(id);
const adminPassword = () => sessionStorage.getItem('ssb-admin-password') || '';
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword(), ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || body.error || 'Request failed');
  return body;
};
const loginPanel = $('login-panel'); const dashboard = $('dashboard'); const loginForm = $('login-form'); const loginMessage = $('login-message');
const accountForm = $('account-form'); const accountMessage = $('account-message'); const accountList = $('account-list');
const videoForm = $('video-form'); const videoMessage = $('video-message'); const videoList = $('video-list'); const videoAccount = $('video-account');
const photoForm = $('photo-form'); const photoMessage = $('photo-message'); const photoList = $('photo-list'); const photoAccount = $('photo-account');

async function renderAccounts() {
  const accounts = await request('/api/admin/accounts');
  [videoAccount, photoAccount].forEach((select) => { select.innerHTML = '<option value="">Choose account</option>'; accounts.forEach((account) => select.add(new Option(account.name, account.id))); });
  accountList.innerHTML = accounts.length ? '' : '<p class="empty">No Cloudinary account added yet.</p>';
  accounts.forEach((account) => {
    const row = document.createElement('div'); row.className = 'account-entry';
    row.innerHTML = `<div><strong>${account.name}</strong><span>${account.cloudName}</span></div><button class="delete" type="button">Remove</button>`;
    row.querySelector('button').onclick = async () => { try { await request(`/api/admin/accounts/${account.id}`, { method: 'DELETE' }); await renderAccounts(); } catch (error) { accountMessage.textContent = error.message; } };
    accountList.append(row);
  });
}

async function renderMedia(kind) {
  const list = kind === 'video' ? videoList : photoList;
  const items = await request(`/api/admin/${kind}s`);
  list.innerHTML = items.length ? '' : `<p class="empty">No lodge ${kind}s published yet.</p>`;
  items.forEach((item, index) => {
    const row = document.createElement('div'); row.className = 'video-entry';
    row.innerHTML = `<div><strong>${String(index + 1).padStart(2, '0')} · ${item.title}</strong><span>${item.category || (kind === 'video' ? 'Lodge video' : 'Lodge photo')}</span></div><div class="video-actions"><button class="delete" type="button">Remove</button></div>`;
    row.querySelector('.delete').onclick = async () => { try { await request(`/api/admin/${kind}s/${item.id}`, { method: 'DELETE' }); await renderMedia(kind); } catch (error) { (kind === 'video' ? videoMessage : photoMessage).textContent = error.message; } };
    list.append(row);
  });
}

async function uploadFile(file, accountId, resourceType, message) {
  message.textContent = 'Creating secure Cloudinary upload…';
  const signed = await request('/api/admin/sign', { method: 'POST', body: JSON.stringify({ account_id: accountId }) });
  const form = new FormData();
  [['file', file], ['api_key', signed.apiKey], ['timestamp', signed.timestamp], ['folder', signed.folder], ['signature', signed.signature]].forEach(([key, value]) => form.append(key, value));
  message.textContent = `Uploading ${resourceType} to Cloudinary…`;
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`, { method: 'POST', body: form });
  const uploaded = await response.json();
  if (!response.ok) throw new Error(uploaded.error?.message || 'Cloudinary upload failed');
  return uploaded;
}

async function showDashboard() { loginPanel.hidden = true; dashboard.hidden = false; await Promise.all([renderAccounts(), renderMedia('video'), renderMedia('photo')]); }
loginForm.onsubmit = async (event) => { event.preventDefault(); sessionStorage.setItem('ssb-admin-password', $('password').value); try { await request('/api/admin/verify', { method: 'POST' }); await showDashboard(); } catch (error) { sessionStorage.removeItem('ssb-admin-password'); loginMessage.textContent = error.message; } };
if (adminPassword()) request('/api/admin/verify', { method: 'POST' }).then(showDashboard).catch(() => sessionStorage.removeItem('ssb-admin-password'));
$('logout').onclick = () => { sessionStorage.removeItem('ssb-admin-password'); dashboard.hidden = true; loginPanel.hidden = false; loginForm.reset(); };
accountForm.onsubmit = async (event) => { event.preventDefault(); try { const account = await request('/api/admin/accounts', { method: 'POST', body: JSON.stringify({ name: $('account-name').value.trim(), cloud_name: $('cloud-name').value.trim(), api_key: $('api-key').value.trim(), api_secret: $('api-secret').value.trim() }) }); accountForm.reset(); accountMessage.textContent = `${account.name} is ready for uploads.`; await renderAccounts(); } catch (error) { accountMessage.textContent = error.message; } };
videoForm.onsubmit = async (event) => { event.preventDefault(); const file = $('video-file').files[0]; if (!file) return; try { const uploaded = await uploadFile(file, videoAccount.value, 'video', videoMessage); await request('/api/admin/videos', { method: 'POST', body: JSON.stringify({ account_id: videoAccount.value, title: $('video-title').value.trim(), category: $('video-category').value.trim(), description: $('video-description').value.trim(), secure_url: uploaded.secure_url, public_id: uploaded.public_id }) }); videoForm.reset(); videoMessage.textContent = 'Video uploaded and published.'; await renderMedia('video'); } catch (error) { videoMessage.textContent = error.message; } };
photoForm.onsubmit = async (event) => { event.preventDefault(); const file = $('photo-file').files[0]; if (!file) return; try { const uploaded = await uploadFile(file, photoAccount.value, 'image', photoMessage); await request('/api/admin/photos', { method: 'POST', body: JSON.stringify({ account_id: photoAccount.value, title: $('photo-title').value.trim(), description: $('photo-description').value.trim(), secure_url: uploaded.secure_url, public_id: uploaded.public_id }) }); photoForm.reset(); photoMessage.textContent = 'Photo uploaded and added to the album.'; await renderMedia('photo'); } catch (error) { photoMessage.textContent = error.message; } };
