(() => {
  const monthLabel = document.getElementById('month-label');
  const grid = document.getElementById('calendar-grid');
  const detail = document.getElementById('selected-detail');
  const list = document.getElementById('event-list');
  const count = document.getElementById('event-count');
  const errorMessage = document.getElementById('load-error');
  const retryButton = document.getElementById('retry-load');
  const liveStatus = document.getElementById('live-status');
  const today = new Date();
  const state = {
    year: today.getFullYear(),
    month: today.getMonth(),
    selectedDate: null,
    events: [],
  };

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDate = (key) => {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const monthName = (year, month) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(new Date(year, month, 1));
  const weekdayDate = (key) => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(parseDate(key));
  const statusClass = (status) => status === '中止' ? 'cancelled' : status === '変更あり' ? 'changed' : 'planned';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isLiveEvent = (event, now = new Date()) => {
    if (!event || event.status === '中止' || !event.startTime || !event.endTime) return false;
    const todayKey = keyOf(now);
    if (event.date !== todayKey) return false;
    const toMinutes = (value) => {
      const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    };
    const start = toMinutes(event.startTime);
    const end = toMinutes(event.endTime);
    if (start === null || end === null) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    return current >= start && current < end;
  };

  function renderLiveStatus() {
    const active = state.events.some((event) => isLiveEvent(event));
    liveStatus.hidden = !active;
    document.body.classList.toggle('is-live', active);
  }

  const eventMap = () => {
    const map = new Map();
    state.events.forEach((event) => {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });
    return map;
  };

  function renderCalendar() {
    monthLabel.textContent = monthName(state.year, state.month);
    grid.innerHTML = '';
    const first = new Date(state.year, state.month, 1);
    const days = new Date(state.year, state.month + 1, 0).getDate();
    const offset = first.getDay();
    const totalCells = Math.ceil((offset + days) / 7) * 7;
    const map = eventMap();

    for (let i = 0; i < totalCells; i += 1) {
      const day = i - offset + 1;
      if (day < 1 || day > days) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day is-empty';
        blank.setAttribute('aria-hidden', 'true');
        grid.appendChild(blank);
        continue;
      }
      const date = new Date(state.year, state.month, day);
      const key = keyOf(date);
      const dayEvents = map.get(key) || [];
      const mainEvent = dayEvents[0];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      if (date.getDay() === 0) button.classList.add('is-sunday');
      if (key === keyOf(today)) button.classList.add('is-today');
      if (key === state.selectedDate) button.classList.add('is-selected');
      if (mainEvent) {
        button.classList.add('has-event', `status-${statusClass(mainEvent.status)}`);
        if (dayEvents.some((event) => isLiveEvent(event))) button.classList.add('is-live-day');
        button.setAttribute('aria-label', `${weekdayDate(key)}、${mainEvent.status || '出店予定'}`);
      } else {
        button.setAttribute('aria-label', weekdayDate(key));
      }
      button.innerHTML = `<span class="day-number">${day}</span>${mainEvent ? `<span class="day-status">${escapeHtml(mainEvent.status || '出店予定')}</span>` : ''}${dayEvents.some((event) => isLiveEvent(event)) ? '<span class="day-live-dot" aria-label="出店中"></span>' : ''}`;
      button.addEventListener('click', () => {
        state.selectedDate = key;
        renderCalendar();
        renderSelectedDetail(key);
      });
      grid.appendChild(button);
    }
  }

  function renderSelectedDetail(key) {
    const events = eventMap().get(key) || [];
    if (!events.length) {
      detail.innerHTML = `<p class="detail-hint">${escapeHtml(weekdayDate(key))}の出店予定はありません。</p>`;
      return;
    }
    detail.innerHTML = events.map((event) => {
      const status = event.status || '出店予定';
      const times = [event.startTime && `開始 ${escapeHtml(event.startTime)}`, event.endTime && `終了 ${escapeHtml(event.endTime)}`, event.lastOrder && `最終受付 ${escapeHtml(event.lastOrder)}`].filter(Boolean).join('　／　');
      const place = event.place ? `<span>場所：${escapeHtml(event.place)}</span>` : '';
      return `<div class="detail-entry">
        <div class="detail-head"><h4 class="detail-date">${escapeHtml(weekdayDate(key))}</h4><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></div>
        <p class="detail-meta">${times ? `<span>${times}</span>` : ''}${place}</p>
        ${event.notice ? `<p class="detail-notice">${escapeHtml(event.notice)}</p>` : ''}
      </div>`;
    }).join('<hr class="detail-divider">');
  }

  function renderList() {
    const monthPrefix = `${state.year}-${pad(state.month + 1)}-`;
    const events = state.events.filter((event) => event.date.startsWith(monthPrefix)).sort((a, b) => a.date.localeCompare(b.date));
    count.textContent = `${events.length}件`;
    if (!events.length) {
      list.innerHTML = '<div class="empty-state">現在、次回の出店日程を調整中です。</div>';
      return;
    }
    list.innerHTML = events.map((event) => {
      const date = parseDate(event.date);
      const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(date);
      const status = event.status || '出店予定';
      const time = [event.startTime && event.endTime ? `${event.startTime}〜${event.endTime}` : event.startTime || event.endTime, event.lastOrder && `最終受付 ${event.lastOrder}`].filter(Boolean).join('　／　');
      const note = [time, event.place, event.notice].filter(Boolean).map(escapeHtml).join('　／　');
      return `<article class="event-card">
        <div class="event-date"><strong>${date.getDate()}<span style="font-size:12px">日</span></strong><span>${date.getMonth() + 1}月・${weekday}曜日</span></div>
        <div class="event-summary"><h3>${escapeHtml(event.place || '高円寺氷川神社')}</h3><p>${note || '出店予定です。'}</p></div>
        <span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span>
      </article>`;
    }).join('');
  }

  function renderAll() {
    renderLiveStatus();
    renderCalendar();
    renderList();
    if (state.selectedDate) renderSelectedDetail(state.selectedDate);
    else {
      const thisMonthEvents = state.events.filter((e) => e.date.startsWith(`${state.year}-${pad(state.month + 1)}-`)).sort((a, b) => a.date.localeCompare(b.date));
      const nextEvent = thisMonthEvents.find((e) => e.date >= keyOf(today) && e.status !== '中止') || thisMonthEvents[0];
      if (nextEvent) {
        state.selectedDate = nextEvent.date;
        renderCalendar();
        renderSelectedDetail(nextEvent.date);
      } else {
        detail.innerHTML = '<p class="detail-hint">カレンダーの日付を選択すると、その日の情報を確認できます。</p>';
      }
    }
  }

  function showError() {
    errorMessage.hidden = false;
    retryButton.hidden = false;
    list.innerHTML = '<div class="empty-state">スケジュール情報を取得できませんでした。</div>';
    count.textContent = '—';
    renderCalendar();
  }

  function loadSchedule() {
    errorMessage.hidden = true;
    retryButton.hidden = true;
    if (!window.SCHEDULE_API_URL) {
      state.events = [];
      renderAll();
      return;
    }
    const callbackName = `cb_schedule_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    let finished = false;
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      showError();
    }, 15000);
    window[callbackName] = (payload) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!payload || payload.ok !== true || !Array.isArray(payload.events)) {
        showError();
        return;
      }
      state.events = payload.events.filter((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.date || ''));
      renderAll();
      if (window.liveStatusTimer) clearInterval(window.liveStatusTimer);
      window.liveStatusTimer = setInterval(() => { renderLiveStatus(); renderCalendar(); }, 30000);
    };
    script.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      showError();
    };
    const separator = window.SCHEDULE_API_URL.includes('?') ? '&' : '?';
    script.src = `${window.SCHEDULE_API_URL}${separator}callback=${callbackName}`;
    document.head.appendChild(script);
  }

  document.getElementById('prev-month').addEventListener('click', () => {
    state.month -= 1;
    if (state.month < 0) { state.month = 11; state.year -= 1; }
    state.selectedDate = null;
    renderAll();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    state.month += 1;
    if (state.month > 11) { state.month = 0; state.year += 1; }
    state.selectedDate = null;
    renderAll();
  });
  document.getElementById('today-month').addEventListener('click', () => {
    state.year = today.getFullYear();
    state.month = today.getMonth();
    state.selectedDate = null;
    renderAll();
  });
  retryButton.addEventListener('click', loadSchedule);
  renderAll();
  loadSchedule();
})();
