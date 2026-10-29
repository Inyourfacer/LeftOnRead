// Left On Read: a reminder list for texts you owe, plus reply templates.
// Deliberately has no way to send messages: drafts only go to the clipboard.
(() => {
  'use strict';

  const STORE_KEY = 'leftonread.v1';

  const DEFAULT_TEMPLATES = [
    { title: 'Saw it, replying soon', body: "Hey {name}! Just saw this. Give me a bit and I'll get back to you properly." },
    { title: 'Busy right now', body: "Sorry {name}, I'm slammed today. Can I get back to you tonight?" },
    { title: 'Sorry for the slow reply', body: "So sorry for the slow reply {name}, this totally slipped past me. [answer]" },
    { title: 'Yes to plans', body: "Yes, I'm in! What time works for you, {name}?" },
    { title: 'Can\'t make it', body: "Ah, I wish I could {name}, but I can't make it this time. Rain check? [suggest another day]" },
    { title: 'Following up', body: "Hey {name}, circling back on this. [question]" },
    { title: 'Thank you', body: "Thank you so much {name}, that really means a lot." },
    { title: 'Checking in', body: "Hey {name}! Been thinking about you. How have you been?" },
    { title: 'Happy birthday', body: "Happy birthday {name}! Hope you have the best day 🎉" },
    { title: 'Call instead?', body: "Easier to talk this through, {name}. Free for a quick call [when]?" },
  ];

  // ---------- storage ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.replies) && Array.isArray(data.templates)) return data;
      }
    } catch (_) { /* fall through to defaults */ }
    return { replies: [], templates: DEFAULT_TEMPLATES.map(t => ({ id: uid(), ...t })) };
  }

  let state = load();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (_) { toast("Couldn't save. Is private browsing on?"); }
    render();
  }

  // ---------- helpers ----------
  const $ = sel => document.querySelector(sel);
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids.filter(k => k != null));
    return n;
  };

  function toLocalInput(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function presetDue(kind) {
    const now = new Date();
    const d = new Date(now);
    d.setSeconds(0, 0);
    switch (kind) {
      case '1h': d.setHours(d.getHours() + 1); break;
      case '3h': d.setHours(d.getHours() + 3); break;
      case 'tonight':
        d.setHours(20, 0);
        if (d <= now) d.setDate(d.getDate() + 1);
        break;
      case 'tomorrow': d.setDate(d.getDate() + 1); d.setHours(9, 0); break;
      case 'weekend': {
        const daysToSat = (6 - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + daysToSat);
        d.setHours(10, 0);
        if (d <= now) d.setDate(d.getDate() + 7);
        break;
      }
    }
    return d;
  }

  function describeDue(ts) {
    const diff = ts - Date.now();
    const mins = Math.round(Math.abs(diff) / 60000);
    const span = mins < 60 ? `${mins}m`
      : mins < 60 * 24 ? `${Math.round(mins / 60)}h`
      : `${Math.round(mins / 1440)}d`;
    if (diff <= 0) return mins < 1 ? 'Due now' : `Overdue ${span}`;
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return mins < 60 ? `In ${span}` : `Today ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
  }

  const firstName = name => name.trim().split(/\s+/)[0] || name;
  const fillTemplate = (body, name) => body.replace(/\{name\}/gi, firstName(name));

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Older iOS fallback
      const ta = el('textarea', { value: text });
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  // Builds a calendar event with an alert so iOS can remind you even when the app is closed.
  function downloadCalendarAlert(r) {
    const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Left On Read//EN',
      'BEGIN:VEVENT',
      `UID:${r.id}@leftonread`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(r.dueAt)}`,
      `DTEND:${stamp(r.dueAt + 10 * 60000)}`,
      `SUMMARY:${esc('Reply to ' + r.name)}`,
      r.note ? `DESCRIPTION:${esc(r.note)}` : null,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Reply to ' + r.name)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = el('a', { href: url, download: `reply-to-${firstName(r.name).toLowerCase()}.ics` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- rendering ----------
  let currentView = 'replies';

  function render() {
    const now = Date.now();
    const open = state.replies.filter(r => !r.doneAt).sort((a, b) => a.dueAt - b.dueAt);
    const done = state.replies.filter(r => r.doneAt).sort((a, b) => b.doneAt - a.doneAt);
    const overdue = open.filter(r => r.dueAt <= now).length;

    if (currentView === 'replies') {
      $('#screen-title').textContent = 'To reply';
      $('#screen-sub').textContent = open.length
        ? `${open.length} waiting` + (overdue ? `, ${overdue} overdue` : '')
        : '';
    } else {
      $('#screen-title').textContent = 'Templates';
      $('#screen-sub').textContent = 'Tap one to edit';
    }

    const list = $('#reply-list');
    list.replaceChildren(...open.map(r => replyCard(r, now)));
    $('#replies-empty').hidden = open.length > 0;

    $('#done-section').hidden = done.length === 0;
    $('#done-count').textContent = `(${done.length})`;
    $('#done-list').replaceChildren(...done.slice(0, 30).map(r => doneCard(r)));

    $('#template-list').replaceChildren(...state.templates.map(templateCard));

    if ('setAppBadge' in navigator) {
      (overdue ? navigator.setAppBadge(overdue) : navigator.clearAppBadge()).catch(() => {});
    }
  }

  function replyCard(r, now) {
    const isOverdue = r.dueAt <= now;
    const btn = (label, fn, cls = 'pill') => {
      const b = el('button', { type: 'button', className: cls, textContent: label });
      b.addEventListener('click', fn);
      return b;
    };
    return el('li', { className: 'card' + (isOverdue ? ' overdue' : '') },
      el('div', { className: 'who', textContent: r.name }),
      el('div', { className: 'due', textContent: describeDue(r.dueAt) }),
      r.note ? el('div', { className: 'note', textContent: r.note }) : null,
      el('div', { className: 'row' },
        btn('Draft reply', () => openDraft(r.id), 'pill primary'),
        btn('Done ✓', () => markDone(r.id)),
        btn('Snooze', () => snooze(r.id)),
        btn('Edit', () => openReplyEditor(r.id)),
      ),
    );
  }

  function doneCard(r) {
    const undo = el('button', { type: 'button', className: 'pill', textContent: 'Undo' });
    undo.addEventListener('click', () => {
      const x = state.replies.find(y => y.id === r.id);
      if (x) { x.doneAt = null; save(); }
    });
    return el('li', { className: 'card done' },
      el('div', { className: 'who', textContent: r.name }),
      undo,
    );
  }

  function templateCard(t) {
    const li = el('li', { className: 'card tpl', tabIndex: 0 },
      el('div', { className: 'who', textContent: t.title }),
      el('div', { className: 'body', textContent: t.body }),
    );
    li.addEventListener('click', () => openTemplateEditor(t.id));
    return li;
  }

  // ---------- reply items ----------
  function markDone(id) {
    const r = state.replies.find(x => x.id === id);
    if (!r) return;
    r.doneAt = Date.now();
    save();
    toast(`Nice, ${firstName(r.name)} is handled`);
  }

  function snooze(id, hours = 1) {
    const r = state.replies.find(x => x.id === id);
    if (!r) return;
    r.dueAt = Math.max(Date.now(), r.dueAt) + hours * 3600000;
    save();
    toast(`Snoozed until ${describeDue(r.dueAt).replace(/^In /, 'in ')}`);
  }

  const replyDialog = $('#reply-dialog');
  const replyForm = $('#reply-form');
  let editingReplyId = null;

  function openReplyEditor(id = null) {
    editingReplyId = id;
    const r = id ? state.replies.find(x => x.id === id) : null;
    replyForm.reset();
    $('#reply-dialog-title').textContent = r ? 'Edit reminder' : 'Who do you owe a reply?';
    replyForm.name.value = r ? r.name : '';
    replyForm.note.value = r ? (r.note || '') : '';
    replyForm.due.value = toLocalInput(r ? new Date(r.dueAt) : presetDue('3h'));
    document.querySelectorAll('#due-chips .chip').forEach(c => c.classList.toggle('on', !r && c.dataset.due === '3h'));
    ensureExtraButtons(r);
    replyDialog.showModal();
    if (!r) setTimeout(() => replyForm.name.focus(), 50);
  }

  // Editing an existing item adds "Delete" and "Calendar alert" buttons.
  function ensureExtraButtons(r) {
    replyForm.querySelectorAll('.extra').forEach(n => n.remove());
    if (!r) return;
    const actions = replyForm.querySelector('.actions');
    const del = el('button', { type: 'button', className: 'danger extra', textContent: 'Delete' });
    del.addEventListener('click', () => {
      state.replies = state.replies.filter(x => x.id !== r.id);
      replyDialog.close();
      save();
    });
    const cal = el('button', { type: 'button', className: 'secondary extra', textContent: 'Calendar alert' });
    cal.addEventListener('click', () => downloadCalendarAlert(r));
    actions.prepend(del, cal);
  }

  document.querySelectorAll('#due-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      replyForm.due.value = toLocalInput(presetDue(chip.dataset.due));
      document.querySelectorAll('#due-chips .chip').forEach(c => c.classList.toggle('on', c === chip));
    });
  });
  replyForm.due.addEventListener('input', () =>
    document.querySelectorAll('#due-chips .chip').forEach(c => c.classList.remove('on')));

  replyForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = replyForm.name.value.trim();
    const dueAt = new Date(replyForm.due.value).getTime();
    if (!name || Number.isNaN(dueAt)) return;
    const note = replyForm.note.value.trim();
    if (editingReplyId) {
      Object.assign(state.replies.find(x => x.id === editingReplyId), { name, note, dueAt });
    } else {
      state.replies.push({ id: uid(), name, note, dueAt, createdAt: Date.now(), doneAt: null });
    }
    replyDialog.close();
    save();
    if (!editingReplyId) toast(dueAt <= Date.now() ? 'Added, and it\'s already due' : `Got it. Reminder: ${describeDue(dueAt).toLowerCase()}`);
  });

  // ---------- drafting ----------
  const draftDialog = $('#draft-dialog');
  let draftingId = null;

  function openDraft(id) {
    const r = state.replies.find(x => x.id === id);
    if (!r) return;
    draftingId = id;
    $('#draft-name').textContent = r.name;
    $('#draft-note').textContent = r.note || '';
    $('#draft-note').hidden = !r.note;
    $('#draft-text').value = '';
    $('#draft-templates').replaceChildren(...state.templates.map(t => {
      const c = el('button', { type: 'button', className: 'chip', textContent: t.title });
      c.addEventListener('click', () => {
        $('#draft-text').value = fillTemplate(t.body, r.name);
        $('#draft-templates').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
      });
      return c;
    }));
    draftDialog.showModal();
  }

  $('#copy-draft').addEventListener('click', async () => {
    const text = $('#draft-text').value.trim();
    if (!text) { toast('Pick a template or type something first'); return; }
    const ok = await copyText(text);
    toast(ok ? (/\[[^\]]+\]/.test(text) ? 'Copied. Fill in the [brackets] in Messages' : 'Copied. Paste it in Messages')
             : 'Copy failed. Select the text and copy it manually');
  });
  $('#draft-done').addEventListener('click', () => { draftDialog.close(); markDone(draftingId); });
  $('#draft-snooze').addEventListener('click', () => { draftDialog.close(); snooze(draftingId); });

  // ---------- templates ----------
  const templateDialog = $('#template-dialog');
  const templateForm = $('#template-form');
  let editingTemplateId = null;

  function openTemplateEditor(id = null) {
    editingTemplateId = id;
    const t = id ? state.templates.find(x => x.id === id) : null;
    templateForm.reset();
    $('#template-dialog-title').textContent = t ? 'Edit template' : 'New template';
    templateForm.title.value = t ? t.title : '';
    templateForm.body.value = t ? t.body : '';
    $('#delete-template').hidden = !t;
    templateDialog.showModal();
  }

  templateForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = templateForm.title.value.trim();
    const body = templateForm.body.value.trim();
    if (!title || !body) return;
    if (editingTemplateId) Object.assign(state.templates.find(x => x.id === editingTemplateId), { title, body });
    else state.templates.push({ id: uid(), title, body });
    templateDialog.close();
    save();
  });

  $('#delete-template').addEventListener('click', () => {
    state.templates = state.templates.filter(x => x.id !== editingTemplateId);
    templateDialog.close();
    save();
  });
  $('#new-template').addEventListener('click', () => openTemplateEditor());

  // ---------- shell ----------
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => b.closest('dialog').close()));
  // Tap the dimmed backdrop to dismiss a sheet
  document.querySelectorAll('dialog').forEach(d =>
    d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentView = tab.dataset.view;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      $('#view-replies').hidden = currentView !== 'replies';
      $('#view-templates').hidden = currentView !== 'templates';
      $('#add-reply').hidden = currentView !== 'replies';
      render();
    });
  });

  $('#add-reply').addEventListener('click', () => openReplyEditor());
  $('#clear-done').addEventListener('click', () => {
    state.replies = state.replies.filter(r => !r.doneAt);
    save();
  });

  // Keep "due in / overdue" labels fresh, and refresh when you come back to the app.
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
