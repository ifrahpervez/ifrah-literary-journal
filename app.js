/*
  Ifrah Pervez — Personal Literary Journal
  Supabase-connected app.js

  IMPORTANT: Replace the two configuration placeholders below with your
  Supabase Project URL and Publishable key. Never use a service_role/secret key.
*/

const SUPABASE_URL = 'https://dsamdkztisdyggmvxqbl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YvCoFRIdfAPPmkL8yEMZhA_IS6WfDid';
const TABLE_NAME = 'article';
const LOCAL_STORAGE_KEY = 'ifrahLiteraryJournalEntriesV3';

function readEntries() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('Could not read local writing archive:', error);
    return [];
  }
}

function saveEntries(items) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function pageFor(section) {
  return ({
    'Essay': 'essays.html',
    'Newspaper Observation': 'observations.html',
    'Independent Opinion': 'opinions.html',
    'Interesting Idea': 'ideas.html',
    'Published Letter': 'published.html'
  })[section] || 'archive.html';
}

let supabaseClientPromise;

function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('PASTE_YOUR_') &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_YOUR_');
}

function loadSupabaseLibrary() {
  if (window.supabase && window.supabase.createClient) {
    return Promise.resolve(window.supabase);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-supabase-library="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.supabase && window.supabase.createClient) resolve(window.supabase);
        else reject(new Error('Supabase library did not load correctly.'));
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Supabase library.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.dataset.supabaseLibrary = 'true';
    script.onload = () => {
      if (window.supabase && window.supabase.createClient) resolve(window.supabase);
      else reject(new Error('Supabase library did not load correctly.'));
    };
    script.onerror = () => reject(new Error('Could not load Supabase library. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClientPromise) {
    supabaseClientPromise = loadSupabaseLibrary().then(library =>
      library.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    );
  }
  return supabaseClientPromise;
}

async function getPublishedEntries() {
  const client = await getSupabaseClient();
  if (!client) return readEntries().filter(entry => entry.status === 'published');

  const { data, error } = await client
    .from(TABLE_NAME)
    .select('*')
    .eq('status', 'published')
    .order('date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Could not load published articles from Supabase:', error.message);
    return readEntries().filter(entry => entry.status === 'published');
  }
  return data || [];
}

async function getPublishedEntryById(id) {
  const client = await getSupabaseClient();
  if (!client) return readEntries().find(entry => entry.id === id && entry.status === 'published') || null;

  const { data, error } = await client
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('Could not load the article:', error.message);
    return readEntries().find(entry => entry.id === id && entry.status === 'published') || null;
  }
  return data || null;
}

async function renderList(target, filter = 'all') {
  const element = document.getElementById(target);
  if (!element) return;

  const items = (await getPublishedEntries())
    .filter(entry => filter === 'all' || entry.section === filter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  element.innerHTML = items.length ? items.map(entry => `
    <article class="entry-row">
      <div class="entry-kind">${esc(entry.section || 'Writing')}</div>
      <div>
        <h2><a href="article.html?id=${encodeURIComponent(entry.id)}">${esc(entry.title || 'Untitled')}</a></h2>
        <p>${esc(entry.intro || '')}</p>
      </div>
      <div class="entry-date">${esc(entry.date || '')}</div>
    </article>`).join('') : '<p class="empty-state">No entries here yet. This section is ready for your writing.</p>';
}

async function setupArchive() {
  const list = document.getElementById('archive-list');
  if (!list) return;

  const search = document.getElementById('search');
  const category = document.getElementById('category');
  const year = document.getElementById('year');
  const sort = document.getElementById('sort');
  const entries = await getPublishedEntries();

  [...new Set(entries.map(entry => (entry.date || '').slice(0, 4)).filter(Boolean))]
    .sort().reverse()
    .forEach(value => year.insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(value)}</option>`));

  function update() {
    let filtered = entries.slice();
    const query = (search.value || '').toLowerCase().trim();

    if (query) {
      filtered = filtered.filter(entry =>
        [entry.title, entry.intro, entry.content, entry.tags, entry.category]
          .join(' ').toLowerCase().includes(query)
      );
    }
    if (category.value !== 'all') filtered = filtered.filter(entry => entry.section === category.value);
    if (year.value !== 'all') filtered = filtered.filter(entry => (entry.date || '').startsWith(year.value));

    filtered.sort((a, b) => (sort.value === 'oldest' ? 1 : -1) * (a.date || '').localeCompare(b.date || ''));
    list.innerHTML = filtered.length ? filtered.map(entry => `
      <article class="entry-row">
        <div class="entry-kind">${esc(entry.section || 'Writing')}</div>
        <div>
          <h2><a href="article.html?id=${encodeURIComponent(entry.id)}">${esc(entry.title || 'Untitled')}</a></h2>
          <p>${esc(entry.intro || '')}</p>
        </div>
        <div class="entry-date">${esc(entry.date || '')}</div>
      </article>`).join('') : '<p class="empty-state">No writing matches these filters.</p>';
  }

  [search, category, year, sort].forEach(control => control.addEventListener('input', update));
  update();
}

async function setupArticle() {
  const root = document.getElementById('article-content');
  if (!root) return;

  const id = new URLSearchParams(location.search).get('id');
  const entry = id ? await getPublishedEntryById(id) : null;

  if (!entry) {
    root.innerHTML = '<p class="empty-state">This article is not available or has not been published.</p>';
    return;
  }

  document.title = `${entry.title || 'Article'} — Ifrah Pervez`;
  root.innerHTML = `
    <div class="article-meta">${esc(entry.section || 'Writing')} · ${esc(entry.date || '')}</div>
    <h1>${esc(entry.title || 'Untitled')}</h1>
    <p class="heading-note">${esc(entry.intro || '')}</p>
    <div class="article-body">${(entry.content || '').split(/\n\s*\n/).map(paragraph =>
      '<p>' + esc(paragraph).replace(/\n/g, '<br>') + '</p>'
    ).join('')}</div>
    ${entry.reference ? `<p class="small-note">Reference: <a href="${esc(entry.reference)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a></p>` : ''}
    <div class="article-actions">
      <a class="outline-button" href="${pageFor(entry.section)}">Back to ${esc(entry.section || 'Writing')}</a>
      <button class="outline-button" onclick="window.print()">Print</button>
    </div>`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function downloadJson(items, filename) {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function setupDesk() {
  const form = document.getElementById('writing-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const notice = document.querySelector('.desk-notice');
  const savedList = $('saved-list');
  let editingId = null;
  let currentSession = null;
  let client = null;
  let onlineEntries = [];

  const authPanel = document.createElement('section');
  authPanel.className = 'desk-notice';
  authPanel.id = 'supabase-auth-panel';
  authPanel.style.marginTop = '1rem';
  if (notice) notice.insertAdjacentElement('afterend', authPanel);

  function setPrivateControlsVisible(visible) {
    form.style.display = visible ? '' : 'none';
    document.querySelectorAll('.desk-page > .desk-actions, .desk-page > .desk-subhead, #saved-list')
      .forEach(element => { element.style.display = visible ? '' : 'none'; });
  }

  function showAuthPanel(message = '') {
    authPanel.innerHTML = `
      <strong>Sign in to your private Writing Desk</strong>
      <p>Your drafts and published work will be saved to your Supabase account, not just this browser.</p>
      <form id="cloud-login-form" class="desk-form" onsubmit="return false">
        <div class="field full"><label for="cloud-email">Email address</label><input id="cloud-email" type="email" autocomplete="username" required></div>
        <div class="field full"><label for="cloud-password">Password</label><input id="cloud-password" type="password" autocomplete="current-password" required></div>
        <div class="field full"><button class="solid-button" id="cloud-login-button" type="submit">Sign in</button></div>
      </form>
      <p id="cloud-auth-message" class="small-note" role="status">${esc(message)}</p>`;

    const loginForm = $('cloud-login-form');
    loginForm.addEventListener('submit', async () => {
      const button = $('cloud-login-button');
      const message = $('cloud-auth-message');
      button.disabled = true;
      button.textContent = 'Signing in…';
      message.textContent = '';
      const { data, error } = await client.auth.signInWithPassword({
        email: $('cloud-email').value.trim(),
        password: $('cloud-password').value
      });
      button.disabled = false;
      button.textContent = 'Sign in';
      if (error) {
        message.textContent = 'Sign-in failed: ' + error.message;
        return;
      }
      currentSession = data.session;
      await showSignedInPanel();
      await loadDeskEntries();
    });
  }

  async function showSignedInPanel() {
    const email = currentSession?.user?.email || 'your account';
    authPanel.innerHTML = `
      <strong>Writing Desk connected</strong>
      <p>Signed in as ${esc(email)}. Your drafts are private to your account.</p>
      <button class="quiet-button" id="cloud-logout-button" type="button">Sign out</button>
      <p id="cloud-auth-message" class="small-note" role="status"></p>`;
    $('cloud-logout-button').addEventListener('click', async () => {
      const { error } = await client.auth.signOut();
      if (error) {
        $('cloud-auth-message').textContent = 'Could not sign out: ' + error.message;
        return;
      }
      currentSession = null;
      onlineEntries = [];
      setPrivateControlsVisible(false);
      showAuthPanel('You have signed out.');
    });
  }

  function formData(status) {
    return {
      title: $('title').value.trim(),
      section: $('section').value,
      category: $('category').value.trim(),
      date: $('date').value || null,
      status,
      intro: $('intro').value.trim(),
      content: $('content').value,
      reference: $('reference').value.trim(),
      newspaper: $('newspaper').value.trim(),
      tags: $('tags').value.trim(),
      published_at: status === 'published' ? new Date().toISOString() : null
    };
  }

  function clearForm() {
    form.reset();
    editingId = null;
    $('entry-id').value = '';
    $('status').value = 'draft';
  }

  function fillForm(entry) {
    editingId = entry.id;
    if ($('entry-id')) $('entry-id').value = entry.id;
    ['title', 'section', 'category', 'date', 'intro', 'content', 'reference', 'newspaper', 'tags', 'status']
      .forEach(field => {
        const input = $(field);
        if (input) input.value = entry[field] == null ? '' : String(entry[field]);
      });
    setPrivateControlsVisible(true);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if ($('title')) $('title').focus({ preventScroll: true });
    const message = $('cloud-auth-message');
    if (message) message.textContent = `Loaded “${entry.title || 'Untitled'}” for editing. Make your changes and save again.`;
  }

 
function drawDeskEntries() {
  const items = onlineEntries.slice().sort(
    (a, b) => (b.date || '').localeCompare(a.date || '')
  );

  // Calculate dashboard statistics
  const totalArticles = items.length;
  const publishedItems = items.filter(
    entry => entry.status === 'published'
  );
  const draftItems = items.filter(
    entry => entry.status !== 'published'
  );

  // Update the statistics cards
  const totalElement = document.getElementById('total-articles');
  const draftsElement = document.getElementById('total-drafts');
  const publishedElement = document.getElementById('total-published');

  if (totalElement) totalElement.textContent = totalArticles;
  if (draftsElement) draftsElement.textContent = draftItems.length;
  if (publishedElement) publishedElement.textContent = publishedItems.length;

  // Display recent writing activity
  const recentActivity = document.getElementById('recent-activity');

  if (recentActivity) {
    if (items.length) {
      const latest = items[0];
      recentActivity.textContent =
        `${latest.title || 'Untitled'} — ${latest.section || 'Writing'} (${latest.status === 'published' ? 'Published' : 'Draft'})`;
    } else {
      recentActivity.textContent = 'No writing activity yet. Start with your first article.';
    }
  }

  // Display saved articles with existing Edit and Delete buttons
  savedList.innerHTML = items.length
    ? items.map(entry => `
      <div class="saved-row">
        <div>
          <strong>${esc(entry.title || 'Untitled')}</strong>
          <small>${esc(entry.section || 'Writing')} · ${esc(entry.status === 'published' ? 'Published online' : 'Private draft')}</small>
        </div>
        <div>
          <button type="button" data-edit="${esc(entry.id)}">Edit</button>
          <button type="button" data-delete="${esc(entry.id)}">Delete</button>
        </div>
      </div>
    `).join('')
    : '<p class="small-note">No saved writing yet. Start with a draft above.</p>';
}

  async function loadDeskEntries() {
    if (!client || !currentSession) return;
    const { data, error } = await client.from(TABLE_NAME).select('*').order('date', { ascending: false, nullsFirst: false });
    if (error) {
      const message = $('cloud-auth-message');
      if (message) message.textContent = 'Could not load your articles: ' + error.message;
      console.error('Could not load Writing Desk entries:', error.message);
      return;
    }
    onlineEntries = data || [];
    drawDeskEntries();
  }

  async function persistCloud(status) {
    if (!currentSession) {
      alert('Please sign in before saving your writing.');
      return;
    }
    const payload = formData(status);
    if (!payload.title) {
      alert('Please add a title first.');
      return;
    }

    let result;
    if (editingId && isUuid(editingId)) {
      result = await client.from(TABLE_NAME).update(payload).eq('id', editingId).select().single();
    } else {
      result = await client.from(TABLE_NAME).insert(payload).select().single();
    }

    if (result.error) {
      alert('Your writing could not be saved: ' + result.error.message);
      console.error('Supabase save error:', result.error);
      return;
    }

    editingId = result.data.id;
    $('entry-id').value = result.data.id;
    $('status').value = status;
    await loadDeskEntries();
    alert(status === 'published'
      ? 'Your article has been published online.'
      : 'Your draft has been saved privately to your account.');
  }

  function persistLocal(status) {
    const payload = formData(status);
    if (!payload.title) {
      alert('Please add a title first.');
      return;
    }
    const items = readEntries();
    const id = editingId || ('w' + Date.now());
    const entry = { ...payload, id };
    const index = items.findIndex(item => item.id === id);
    if (index >= 0) items[index] = entry;
    else items.push(entry);
    saveEntries(items);
    editingId = id;
    $('entry-id').value = id;
    $('status').value = status;
    drawLocalEntries();
    alert(status === 'published'
      ? 'Added to this browser’s archive. This is not online publishing.'
      : 'Draft saved in this browser only.');
  }

  function drawLocalEntries() {
    const items = readEntries().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    savedList.innerHTML = items.length ? items.map(entry => `
      <div class="saved-row">
        <div><strong>${esc(entry.title || 'Untitled')}</strong><small>${esc(entry.section || 'Writing')} · ${esc(entry.status === 'published' ? 'In local archive' : 'Draft')}</small></div>
        <div><button type="button" data-edit="${esc(entry.id)}">Edit</button><button type="button" data-delete="${esc(entry.id)}">Delete</button></div>
      </div>`).join('') : '<p class="small-note">No saved writing yet. Start with a draft above.</p>';
  }

  function previewEntry() {
    const entry = formData($('status').value || 'draft');
    if (!entry.title) {
      alert('Add a title before previewing.');
      return;
    }
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      alert('Please allow pop-ups to preview your article.');
      return;
    }
    previewWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(entry.title)}</title><style>body{max-width:760px;margin:70px auto;padding:0 25px;background:#f4f0e8;color:#282321;font:20px/1.9 Georgia,serif}h1{font-size:52px;font-weight:400}small{color:#71394a;text-transform:uppercase;letter-spacing:2px}</style></head><body><small>${esc(entry.section)} · ${esc(entry.date || '')}</small><h1>${esc(entry.title)}</h1><p>${esc(entry.intro)}</p>${(entry.content || '').split(/\n\s*\n/).map(paragraph => '<p>' + esc(paragraph).replace(/\n/g, '<br>') + '</p>').join('')}</body></html>`);
    previewWindow.document.close();
  }

  $('save-draft').onclick = () => client ? persistCloud('draft') : persistLocal('draft');
  $('publish').onclick = () => client ? persistCloud('published') : persistLocal('published');
  $('preview').onclick = previewEntry;
  $('reset-form').onclick = clearForm;

  $('export').onclick = async () => {
    const entries = client && currentSession ? onlineEntries : readEntries();
    downloadJson(entries, 'ifrah-writing-archive-backup.json');
  };

  $('import-file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error('The backup must contain a list of entries.');
        if (!confirm(`Import ${imported.length} entries into your ${client ? 'online' : 'local'} archive?`)) return;

        if (client && currentSession) {
          for (const oldEntry of imported) {
            const status = oldEntry.status === 'published' ? 'published' : 'draft';
            const payload = {
              title: String(oldEntry.title || 'Untitled'),
              section: String(oldEntry.section || 'Essay'),
              category: String(oldEntry.category || ''),
              date: oldEntry.date || null,
              intro: String(oldEntry.intro || ''),
              content: String(oldEntry.content || ''),
              reference: String(oldEntry.reference || ''),
              newspaper: String(oldEntry.newspaper || ''),
              tags: String(oldEntry.tags || ''),
              status,
              published_at: status === 'published' ? (oldEntry.published_at || new Date().toISOString()) : null
            };
            const { error } = await client.from(TABLE_NAME).insert(payload);
            if (error) throw error;
          }
          await loadDeskEntries();
        } else {
          const merged = readEntries();
          imported.forEach(entry => {
            const index = merged.findIndex(item => item.id === entry.id);
            if (index >= 0) merged[index] = entry;
            else merged.push(entry);
          });
          saveEntries(merged);
          drawLocalEntries();
        }
        alert('Your backup has been imported.');
      } catch (error) {
        alert('The backup could not be imported: ' + error.message);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  savedList.addEventListener('click', async event => {
    const button = event.target.closest('button[data-edit], button[data-delete]');
    if (!button || !savedList.contains(button)) return;

    const editId = button.getAttribute('data-edit');
    const deleteId = button.getAttribute('data-delete');

    if (client && currentSession) {
      if (editId) {
        let entry = onlineEntries.find(item => String(item.id) === String(editId));

        // If the in-memory list does not contain the row, retrieve it directly.
        if (!entry) {
          const { data, error } = await client
            .from(TABLE_NAME)
            .select('*')
            .eq('id', editId)
            .maybeSingle();
          if (error) {
            alert('Could not load this article for editing: ' + error.message);
            console.error('Edit load error:', error);
            return;
          }
          entry = data;
        }

        if (!entry) {
          alert('This article could not be found in your account. Please refresh the page and try again.');
          return;
        }

        fillForm(entry);
        return;
      }

      if (deleteId && confirm('Permanently delete this article from your online account?')) {
        const { error } = await client.from(TABLE_NAME).delete().eq('id', deleteId);
        if (error) alert('Could not delete the article: ' + error.message);
        else {
          if (editingId === deleteId) clearForm();
          await loadDeskEntries();
        }
      }
      return;
    }

    const items = readEntries();
    const entry = items.find(item => String(item.id) === String(editId || deleteId));
    if (editId && entry) fillForm(entry);
    else if (deleteId && confirm('Delete this entry from this browser?')) {
      saveEntries(items.filter(item => String(item.id) !== String(deleteId)));
      drawLocalEntries();
    }
  });

  // Keep local-only behaviour until the owner adds the two Supabase credentials.
  if (!isSupabaseConfigured()) {
    if (notice) notice.innerHTML = '<strong>Private writing workspace</strong><p>Supabase credentials have not yet been added to app.js. For now, this desk continues to save work in this browser only.</p>';
    authPanel.remove();
    setPrivateControlsVisible(true);
    drawLocalEntries();
    return;
  }

  try {
    client = await getSupabaseClient();
    if (!client) throw new Error('Supabase has not been configured.');
    if (notice) notice.innerHTML = '<strong>Online writing workspace</strong><p>Sign in to save drafts privately to your account and publish articles to your literary journal.</p>';
    $('publish').textContent = 'Publish online';
    const publishedOption = $('status').querySelector('option[value="published"]');
    if (publishedOption) publishedOption.textContent = 'Published online';
    setPrivateControlsVisible(false);
    showAuthPanel();

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data.session;

    if (currentSession) {
      setPrivateControlsVisible(true);
      await showSignedInPanel();
      await loadDeskEntries();
    }

    client.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      if (session) {
        setPrivateControlsVisible(true);
        showSignedInPanel();
        loadDeskEntries();
      } else {
        onlineEntries = [];
        setPrivateControlsVisible(false);
        showAuthPanel('You have signed out.');
      }
    });
  } catch (error) {
    console.error('Supabase initialisation error:', error);
    setPrivateControlsVisible(false);
    showAuthPanel('The online Writing Desk could not connect: ' + error.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      const icon = toggle.querySelector('i');
      if (icon) icon.textContent = open ? '−' : '＋';
    });
  }

  renderList('essay-list', 'Essay');
  renderList('observation-list', 'Newspaper Observation');
  renderList('opinion-list', 'Independent Opinion');
  renderList('idea-list', 'Interesting Idea');
  renderList('letter-list', 'Published Letter');
  setupArchive();
  setupArticle();
  setupDesk();
});
