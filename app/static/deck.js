/**
 * Mastoferr Modular Deck Engine
 * Handles dynamic customizable columns, live Mastodon feeds, hashtag tracking,
 * column resizing/reordering, and live toot interactions (Favorite, Boost, Bookmark, Reply).
 */

const DECK_STORAGE_KEY = 'mastoferr_deck_columns_v2';
const DEFAULT_WIDTHS = [300, 360, 440];

const DEFAULT_COLUMNS = [
    { type: 'compose', id: 'col-compose', title: 'Compose', width: 320, permanent: true },
    { type: 'home', id: 'col-home', title: 'Home', width: 360 },
    { type: 'notifications', id: 'col-notifs', title: 'Notifications', width: 360 },
    { type: 'hashtag', id: 'col-tag-1', title: '#selfhosted', tag: 'selfhosted', width: 360 },
    { type: 'favorites', id: 'col-favs', title: 'Favorites', width: 360 },
];

let deckColumns = [];

function initDeck() {
    loadColumns();
    renderColumns();
}

function loadColumns() {
    try {
        const saved = localStorage.getItem(DECK_STORAGE_KEY);
        if (saved) {
            deckColumns = JSON.parse(saved);
            if (!deckColumns.find(c => c.type === 'compose')) {
                deckColumns.unshift({ type: 'compose', id: 'col-compose', title: 'Compose', width: 320, permanent: true });
            }
        } else {
            deckColumns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
        }
    } catch (e) {
        console.error('Failed to parse saved deck columns:', e);
        deckColumns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
    }
}

function saveColumns() {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckColumns));
}

function renderColumns() {
    const wrapper = document.getElementById('deck-scroll-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';

    deckColumns.forEach((col, index) => {
        const colEl = createColumnElement(col, index);
        wrapper.appendChild(colEl);

        if (col.type === 'compose') {
            initComposeColumn(colEl);
        } else {
            fetchColumnData(col);
        }
    });
}

function createColumnElement(col, index) {
    const el = document.createElement('div');
    el.className = `deck-col deck-col-${col.type}`;
    el.id = col.id;
    el.style.flex = `0 0 ${col.width || 360}px`;
    el.style.width = `${col.width || 360}px`;
    el.style.minWidth = `${col.width || 360}px`;
    el.style.maxWidth = `${col.width || 360}px`;

    const iconMap = {
        compose: '✍️',
        home: '🏠',
        hashtag: '🏷️',
        public: '🌐',
        notifications: '🔔',
        favorites: '⭐',
        bookmarks: '🔖',
        archive: '💬',
        trends: '📊',
        thread: '🧵',
        profile: '👤',
    };

    const icon = iconMap[col.type] || '📄';
    const isFirstMovable = index <= 1; // 0 is compose
    const isLastMovable = index === deckColumns.length - 1;

    let headerControls = '';
    if (col.type === 'thread' || col.type === 'profile') {
        headerControls = `
            <div class="deck-col-controls">
                <button class="btn-col-action btn-col-back" onclick="removeColumn('${col.id}')" title="Back">← Back</button>
                <button class="btn-col-action" onclick="cycleColumnWidth('${col.id}')" title="Change Width (${col.width || 380}px)">📏</button>
                <button class="btn-col-action" onclick="refreshColumn('${col.id}')" title="Refresh">🔄</button>
                <button class="btn-col-action btn-col-close" onclick="removeColumn('${col.id}')" title="Close">✖</button>
            </div>
        `;
    } else if (col.type === 'hashtag') {
        headerControls = `
            <div class="deck-col-controls">
                <button class="btn-col-action btn-col-settings ${col.settingsOpen ? 'active' : ''}" onclick="toggleHashtagSettings('${col.id}')" title="Hashtag Column Settings">${col.settingsOpen ? '⌃' : '⌄'}</button>
                <button class="btn-col-action" onclick="moveColumn('${col.id}', -1)" title="Move Left" ${isFirstMovable ? 'disabled' : ''}>◀</button>
                <button class="btn-col-action" onclick="moveColumn('${col.id}', 1)" title="Move Right" ${isLastMovable ? 'disabled' : ''}>▶</button>
                <button class="btn-col-action" onclick="cycleColumnWidth('${col.id}')" title="Change Width (${col.width || 360}px)">📏</button>
                <button class="btn-col-action" onclick="refreshColumn('${col.id}')" title="Refresh Feed">🔄</button>
                <button class="btn-col-action btn-col-close" onclick="removeColumn('${col.id}')" title="Close Column">✖</button>
            </div>
        `;
    } else if (!col.permanent) {
        headerControls = `
            <div class="deck-col-controls">
                <button class="btn-col-action" onclick="moveColumn('${col.id}', -1)" title="Move Left" ${isFirstMovable ? 'disabled' : ''}>◀</button>
                <button class="btn-col-action" onclick="moveColumn('${col.id}', 1)" title="Move Right" ${isLastMovable ? 'disabled' : ''}>▶</button>
                <button class="btn-col-action" onclick="cycleColumnWidth('${col.id}')" title="Change Width (${col.width || 360}px)">📏</button>
                <button class="btn-col-action" onclick="refreshColumn('${col.id}')" title="Refresh Feed">🔄</button>
                <button class="btn-col-action btn-col-close" onclick="removeColumn('${col.id}')" title="Close Column">✖</button>
            </div>
        `;
    } else {
        headerControls = `
            <div class="deck-col-controls">
                <button class="btn-col-action" onclick="cycleColumnWidth('${col.id}')" title="Change Width (${col.width || 320}px)">📏</button>
            </div>
        `;
    }

    let filterBarHtml = '';
    if (col.type === 'notifications') {
        filterBarHtml = `
            <div class="deck-filter-bar" data-col-id="${col.id}">
                <button class="deck-pill active" onclick="setNotifFilter('${col.id}', '')">All</button>
                <button class="deck-pill" onclick="setNotifFilter('${col.id}', 'mention')">Mentions</button>
                <button class="deck-pill" onclick="setNotifFilter('${col.id}', 'favourite')">Favorites</button>
                <button class="deck-pill" onclick="setNotifFilter('${col.id}', 'reblog')">Boosts</button>
                <button class="deck-pill" onclick="setNotifFilter('${col.id}', 'follow')">Follows</button>
            </div>
        `;
    } else if (col.type === 'public') {
        filterBarHtml = `
            <div class="deck-filter-bar" data-col-id="${col.id}">
                <button class="deck-pill ${col.local ? '' : 'active'}" onclick="setPublicScope('${col.id}', 0)">Federated</button>
                <button class="deck-pill ${col.local ? 'active' : ''}" onclick="setPublicScope('${col.id}', 1)">Local</button>
            </div>
        `;
    } else if (col.type === 'archive') {
        filterBarHtml = `
            <div class="deck-filter-bar" data-col-id="${col.id}">
                <button class="deck-pill active" onclick="setArchiveFilter('${col.id}', 'all')">All</button>
                <button class="deck-pill" onclick="setArchiveFilter('${col.id}', 'post')">Posts</button>
                <button class="deck-pill" onclick="setArchiveFilter('${col.id}', 'reply')">Replies</button>
                <button class="deck-pill" onclick="setArchiveFilter('${col.id}', 'boost')">Boosts</button>
            </div>
        `;
    } else if (col.type === 'profile') {
        const activeF = col.filter || 'posts';
        filterBarHtml = `
            <div class="deck-filter-bar" data-col-id="${col.id}">
                <button class="deck-pill ${activeF === 'posts' ? 'active' : ''}" onclick="setProfileFilter('${col.id}', 'posts')">Posts</button>
                <button class="deck-pill ${activeF === 'all' ? 'active' : ''}" onclick="setProfileFilter('${col.id}', 'all')">Posts & Replies</button>
                <button class="deck-pill ${activeF === 'media' ? 'active' : ''}" onclick="setProfileFilter('${col.id}', 'media')">Media</button>
            </div>
        `;
    }

    const displayTitle = col.type === 'hashtag' ? computeHashtagTitle(col) : col.title;
    const settingsPanelHtml = (col.type === 'hashtag' && col.settingsOpen) ? renderHashtagSettingsPanel(col) : '';

    el.innerHTML = `
        <div class="deck-col-header">
            <div class="deck-col-title" title="${escapeHtml(displayTitle)}">
                <span class="deck-col-icon">${icon}</span>
                <h2>${escapeHtml(displayTitle)}</h2>
                <span class="deck-badge" id="${col.id}-badge"></span>
            </div>
            ${headerControls}
        </div>
        ${filterBarHtml}
        ${settingsPanelHtml}
        <div class="deck-col-content" id="${col.id}-content">
            <div class="deck-loading"><span class="spinner"></span> Loading stream...</div>
        </div>
    `;

    return el;
}

function initComposeColumn(colEl) {
    const template = document.getElementById('deck-compose-template');
    const content = colEl.querySelector('.deck-col-content');
    if (template && content) {
        content.innerHTML = template.innerHTML;
        const textarea = content.querySelector('#compose-text');
        const form = content.querySelector('#deck-compose-form');
        if (textarea) {
            textarea.addEventListener('input', updateCharCount);
        }

        // Setup Paste Event Listener for Clipboard Images
        if (form) {
            form.addEventListener('paste', handleClipboardPaste);

            // Drag and Drop support
            form.addEventListener('dragover', (e) => {
                e.preventDefault();
                form.classList.add('drag-over');
            });
            form.addEventListener('dragleave', () => {
                form.classList.remove('drag-over');
            });
            form.addEventListener('drop', (e) => {
                e.preventDefault();
                form.classList.remove('drag-over');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    Array.from(e.dataTransfer.files).forEach(uploadMediaFile);
                }
            });
        }
    }
}

async function fetchColumnData(col) {
    const contentEl = document.getElementById(`${col.id}-content`);
    const badgeEl = document.getElementById(`${col.id}-badge`);
    if (!contentEl) return;

    let url = '';
    if (col.type === 'home') {
        url = '/api/deck/feed/home';
    } else if (col.type === 'hashtag') {
        url = `/api/deck/feed/hashtag/${encodeURIComponent(col.tag || 'mastodon')}`;
        const params = [];
        if (col.localOnly) params.push('local=1');
        if (col.includeAdditional) {
            if (col.anyTags && col.anyTags.length) params.push(`any=${col.anyTags.map(encodeURIComponent).join(',')}`);
            if (col.allTags && col.allTags.length) params.push(`all=${col.allTags.map(encodeURIComponent).join(',')}`);
            if (col.noneTags && col.noneTags.length) params.push(`none=${col.noneTags.map(encodeURIComponent).join(',')}`);
        }
        if (params.length) {
            url += `?${params.join('&')}`;
        }
    } else if (col.type === 'public') {
        url = `/api/deck/feed/public?local=${col.local ? 1 : 0}`;
    } else if (col.type === 'notifications') {
        url = `/api/deck/feed/notifications`;
    } else if (col.type === 'favorites') {
        url = `/api/deck/feed/favorites`;
    } else if (col.type === 'bookmarks') {
        url = `/api/deck/feed/bookmarks`;
    } else if (col.type === 'archive') {
        url = `/api/deck/feed/archive?filter=${encodeURIComponent(col.filter || 'all')}`;
    } else if (col.type === 'trends') {
        url = `/api/deck/feed/trends`;
    } else if (col.type === 'thread') {
        url = `/api/deck/toot/${col.tootId}/context`;
    } else if (col.type === 'profile') {
        url = `/api/deck/account/${encodeURIComponent(col.accountId)}`;
    }

    try {
        if (col.type === 'profile') {
            const [profResp, statusResp] = await Promise.all([
                fetch(`/api/deck/account/${encodeURIComponent(col.accountId)}`),
                fetch(`/api/deck/account/${encodeURIComponent(col.accountId)}/statuses?filter=${encodeURIComponent(col.filter || 'posts')}`)
            ]);
            const profData = await profResp.json();
            const statusData = await statusResp.json();

            if (profData.status === 'error') {
                contentEl.innerHTML = `<div class="deck-empty-inline error">${escapeHtml(profData.message)}</div>`;
                return;
            }
            renderUserProfileView(contentEl, profData, statusData, col.id);
            return;
        }

        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status === 'error') {
            contentEl.innerHTML = `<div class="deck-empty-inline error">${escapeHtml(data.message)}</div>`;
            return;
        }

        if (col.type === 'trends') {
            renderTrendsColumn(contentEl, data);
            return;
        }

        if (col.type === 'thread') {
            renderThreadView(contentEl, data, col.id);
            return;
        }

        const items = data.items || [];
        if (badgeEl) {
            badgeEl.textContent = items.length ? items.length : '';
        }

        if (!items.length) {
            contentEl.innerHTML = `<div class="deck-empty">No items in this feed.</div>`;
            return;
        }

        let html = '';
        if (col.type === 'notifications') {
            const activeFilter = col.filter || '';
            const filteredItems = activeFilter ? items.filter(n => n.type === activeFilter) : items;
            html = filteredItems.map(renderNotificationCard).join('');
        } else {
            html = items.map(t => renderTootCard(t)).join('');
        }

        contentEl.innerHTML = html;
    } catch (err) {
        contentEl.innerHTML = `<div class="deck-empty-inline error">Failed to load feed: ${escapeHtml(err.message)}</div>`;
    }
}

function handleCardClick(e, tootId) {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('textarea') || e.target.closest('input') || e.target.closest('.media-item') || e.target.closest('.deck-reply-box') || e.target.closest('.deck-author-link') || e.target.closest('.deck-author-link-inline')) {
        return;
    }
    openTootThread(tootId);
}

function openTootThread(tootId) {
    let threadCol = deckColumns.find(c => c.type === 'thread');
    if (threadCol) {
        threadCol.tootId = tootId;
        threadCol.title = 'Thread';
    } else {
        threadCol = {
            type: 'thread',
            id: 'col-thread',
            title: 'Thread',
            tootId: tootId,
            width: 400,
        };
        deckColumns.push(threadCol);
    }
    saveColumns();
    renderColumns();

    setTimeout(() => {
        const el = document.getElementById(threadCol.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
    }, 120);
}

function setProfileFilter(colId, filter) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.filter = filter;
    saveColumns();
    renderColumns();
}

function openUserProfile(accountId, username = '') {
    if (!accountId) return;
    let profCol = deckColumns.find(c => c.type === 'profile');
    const displayTitle = username ? (username.startsWith('@') ? username : `@${username}`) : 'Profile';
    if (profCol) {
        profCol.accountId = accountId;
        profCol.title = displayTitle;
        profCol.filter = profCol.filter || 'posts';
    } else {
        profCol = {
            type: 'profile',
            id: 'col-profile',
            title: displayTitle,
            accountId: accountId,
            filter: 'posts',
            width: 400,
        };
        deckColumns.push(profCol);
    }
    saveColumns();
    renderColumns();

    setTimeout(() => {
        const el = document.getElementById(profCol.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
    }, 120);
}

// ── Hashtag Column Multi-Tag & Local Settings ────────────────────────────────

function computeHashtagTitle(col) {
    const baseTag = (col.tag || '').replace(/^#/, '') || 'hashtag';
    if (!col.includeAdditional) {
        return `# ${baseTag}`;
    }
    if (col.anyTags && col.anyTags.length) {
        const anyStr = col.anyTags.join('/');
        return `# ${baseTag} or ${anyStr.length > 22 ? anyStr.substring(0, 20) + '...' : anyStr}`;
    }
    if (col.allTags && col.allTags.length) {
        const allStr = col.allTags.join('+');
        return `# ${baseTag} + ${allStr.length > 22 ? allStr.substring(0, 20) + '...' : allStr}`;
    }
    return `# ${baseTag}`;
}

function renderHashtagSettingsPanel(col) {
    const isFirstMovable = deckColumns.findIndex(c => c.id === col.id) <= 1;
    const isLastMovable = deckColumns.findIndex(c => c.id === col.id) === deckColumns.length - 1;

    const anyChips = (col.anyTags || []).map((t, idx) => `
        <span class="hashtag-chip">
            #${escapeHtml(t)}
            <button type="button" class="chip-remove" onclick="event.stopPropagation(); removeHashtagTag('${col.id}', 'any', ${idx})">✖</button>
        </span>
    `).join('');

    const allChips = (col.allTags || []).map((t, idx) => `
        <span class="hashtag-chip">
            #${escapeHtml(t)}
            <button type="button" class="chip-remove" onclick="event.stopPropagation(); removeHashtagTag('${col.id}', 'all', ${idx})">✖</button>
        </span>
    `).join('');

    const noneChips = (col.noneTags || []).map((t, idx) => `
        <span class="hashtag-chip">
            #${escapeHtml(t)}
            <button type="button" class="chip-remove" onclick="event.stopPropagation(); removeHashtagTag('${col.id}', 'none', ${idx})">✖</button>
        </span>
    `).join('');

    let additionalSections = '';
    if (col.includeAdditional) {
        additionalSections = `
            <div class="hashtag-filter-section">
                <label class="filter-section-title">Any of these</label>
                <div class="hashtag-tag-box" onclick="focusTagInput('${col.id}', 'any')">
                    <div class="hashtag-chips-wrap" id="${col.id}-any-chips">
                        ${anyChips}
                        <input type="text" class="hashtag-chip-input" id="${col.id}-any-input" placeholder="${(col.anyTags && col.anyTags.length) ? '' : 'Enter hashtags...'}" onkeydown="handleHashtagInputKey('${col.id}', 'any', event)">
                    </div>
                    ${(col.anyTags && col.anyTags.length) ? `<button type="button" class="btn-clear-tags" onclick="event.stopPropagation(); clearHashtagGroup('${col.id}', 'any')" title="Clear all">✖</button>` : ''}
                    <span class="tag-box-arrow">⌄</span>
                </div>
            </div>

            <div class="hashtag-filter-section">
                <label class="filter-section-title">All of these</label>
                <div class="hashtag-tag-box" onclick="focusTagInput('${col.id}', 'all')">
                    <div class="hashtag-chips-wrap" id="${col.id}-all-chips">
                        ${allChips}
                        <input type="text" class="hashtag-chip-input" id="${col.id}-all-input" placeholder="${(col.allTags && col.allTags.length) ? '' : 'Enter hashtags...'}" onkeydown="handleHashtagInputKey('${col.id}', 'all', event)">
                    </div>
                    ${(col.allTags && col.allTags.length) ? `<button type="button" class="btn-clear-tags" onclick="event.stopPropagation(); clearHashtagGroup('${col.id}', 'all')" title="Clear all">✖</button>` : ''}
                    <span class="tag-box-arrow">⌄</span>
                </div>
            </div>

            <div class="hashtag-filter-section">
                <label class="filter-section-title">None of these</label>
                <div class="hashtag-tag-box" onclick="focusTagInput('${col.id}', 'none')">
                    <div class="hashtag-chips-wrap" id="${col.id}-none-chips">
                        ${noneChips}
                        <input type="text" class="hashtag-chip-input" id="${col.id}-none-input" placeholder="${(col.noneTags && col.noneTags.length) ? '' : 'Enter hashtags...'}" onkeydown="handleHashtagInputKey('${col.id}', 'none', event)">
                    </div>
                    ${(col.noneTags && col.noneTags.length) ? `<button type="button" class="btn-clear-tags" onclick="event.stopPropagation(); clearHashtagGroup('${col.id}', 'none')" title="Clear all">✖</button>` : ''}
                    <span class="tag-box-arrow">⌄</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="hashtag-settings-panel">
            <div class="hashtag-toggle-row" onclick="toggleHashtagLocal('${col.id}')">
                <div class="switch-control ${col.localOnly ? 'checked' : ''}">
                    <div class="switch-thumb"></div>
                </div>
                <span class="switch-label">Local only</span>
            </div>

            <div class="hashtag-toggle-row" onclick="toggleHashtagAdditional('${col.id}')">
                <div class="switch-control ${col.includeAdditional ? 'checked' : ''}">
                    <div class="switch-thumb"></div>
                </div>
                <span class="switch-label">Include additional tags for this column</span>
            </div>

            ${additionalSections}

            <div class="hashtag-settings-footer">
                <button type="button" class="btn-hashtag-unpin" onclick="removeColumn('${col.id}')">✖ Unpin</button>
                <div class="hashtag-nav-arrows">
                    <button type="button" class="btn-hashtag-arrow" onclick="moveColumn('${col.id}', -1)" ${isFirstMovable ? 'disabled' : ''} title="Move Left">❮</button>
                    <button type="button" class="btn-hashtag-arrow" onclick="moveColumn('${col.id}', 1)" ${isLastMovable ? 'disabled' : ''} title="Move Right">❯</button>
                </div>
            </div>
        </div>
    `;
}

function toggleHashtagSettings(colId) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.settingsOpen = !col.settingsOpen;
    saveColumns();
    renderColumns();
}

function toggleHashtagLocal(colId) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.localOnly = !col.localOnly;
    saveColumns();
    renderColumns();
    fetchColumnData(col);
}

function toggleHashtagAdditional(colId) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.includeAdditional = !col.includeAdditional;
    col.title = computeHashtagTitle(col);
    saveColumns();
    renderColumns();
    fetchColumnData(col);
}

function focusTagInput(colId, group) {
    const input = document.getElementById(`${colId}-${group}-input`);
    if (input) input.focus();
}

function handleHashtagInputKey(colId, group, event) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
        event.preventDefault();
        const input = event.target;
        const val = input.value.replace(/^[#\s]+/, '').trim();
        if (!val) return;

        const col = deckColumns.find(c => c.id === colId);
        if (!col) return;

        const prop = `${group}Tags`;
        if (!col[prop]) col[prop] = [];
        if (!col[prop].includes(val)) {
            col[prop].push(val);
            col.title = computeHashtagTitle(col);
            saveColumns();
            renderColumns();
            fetchColumnData(col);

            setTimeout(() => {
                const nextInput = document.getElementById(`${colId}-${group}-input`);
                if (nextInput) nextInput.focus();
            }, 60);
        } else {
            input.value = '';
        }
    } else if (event.key === 'Backspace' && !event.target.value) {
        const col = deckColumns.find(c => c.id === colId);
        if (!col) return;
        const prop = `${group}Tags`;
        if (col[prop] && col[prop].length) {
            col[prop].pop();
            col.title = computeHashtagTitle(col);
            saveColumns();
            renderColumns();
            fetchColumnData(col);
        }
    }
}

function removeHashtagTag(colId, group, index) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    const prop = `${group}Tags`;
    if (col[prop]) {
        col[prop].splice(index, 1);
        col.title = computeHashtagTitle(col);
        saveColumns();
        renderColumns();
        fetchColumnData(col);
    }
}

function clearHashtagGroup(colId, group) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col[`${group}Tags`] = [];
    col.title = computeHashtagTitle(col);
    saveColumns();
    renderColumns();
    fetchColumnData(col);
}

function renderTootCard(toot, isThreadItem = false) {
    window.tootsMap = window.tootsMap || {};
    window.tootsMap[toot.id] = toot;

    const acct = toot.account || {};
    const hasCw = Boolean(toot.spoiler_text && toot.spoiler_text.trim());
    const cardId = `card-${toot.id || Math.random().toString(36).substring(7)}`;

    let reblogHeader = '';
    if (toot.is_reblog && toot.reblogged_by) {
        const rAcc = toot.reblogged_by;
        reblogHeader = `
            <div class="deck-reblog-header">
                <span>🔁 <span class="deck-author-link-inline" onclick="event.stopPropagation(); openUserProfile('${rAcc.id}', '${escapeHtml(rAcc.username || rAcc.acct)}')">${escapeHtml(rAcc.display_name || rAcc.acct)}</span> boosted</span>
            </div>
        `;
    }

    let mediaHtml = '';
    if (toot.media_attachments && toot.media_attachments.length > 0) {
        const count = Math.min(toot.media_attachments.length, 4);
        mediaHtml = `<div class="media-grid media-count-${count}">`;
        toot.media_attachments.slice(0, 4).forEach(m => {
            const url = m.url || m.preview_url;
            mediaHtml += `
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="media-item">
                    <img src="${escapeHtml(m.preview_url || url)}" alt="${escapeHtml(m.description || '')}" loading="lazy">
                </a>
            `;
        });
        mediaHtml += `</div>`;
    }

    let bodyContent = toot.content || '';
    let cwHtml = '';
    if (hasCw) {
        cwHtml = `
            <div class="deck-cw-banner">
                <span>⚠️ ${escapeHtml(toot.spoiler_text)}</span>
                <button class="btn-cw-show" onclick="toggleCardCw('${cardId}')">Show more</button>
            </div>
        `;
    }

    let quoteHtml = '';
    if (toot.quote) {
        quoteHtml = renderQuoteEmbedHtml(toot.quote);
    } else if (toot.card && (!toot.media_attachments || toot.media_attachments.length === 0)) {
        const c = toot.card;
        quoteHtml = `
            <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener" class="deck-link-card" onclick="event.stopPropagation();">
                ${c.image ? `<img src="${escapeHtml(c.image)}" alt="" class="link-card-image">` : ''}
                <div class="link-card-content">
                    <span class="link-card-host">${escapeHtml(c.provider_name || 'Link')}</span>
                    <div class="link-card-title">${escapeHtml(c.title || '')}</div>
                    ${c.description ? `<div class="link-card-desc">${escapeHtml(c.description)}</div>` : ''}
                </div>
            </a>
        `;
    }

    const timeStr = formatRelativeTime(toot.created_at);

    return `
        <div class="deck-card deck-card-clickable ${isThreadItem ? 'deck-card-thread' : ''}" id="${cardId}" onclick="handleCardClick(event, '${toot.id}')">
            ${reblogHeader}
            <div class="deck-card-header">
                <div class="deck-author-link" onclick="event.stopPropagation(); openUserProfile('${acct.id}', '${escapeHtml(acct.username || acct.acct)}')">
                    <img src="${escapeHtml(acct.avatar || '/static/logo.png')}" alt="" class="deck-author-avatar">
                    <div class="deck-author-meta">
                        <span class="deck-author-name">${escapeHtml(acct.display_name || acct.username || 'User')}</span>
                        <span class="deck-author-handle">@${escapeHtml(acct.acct || '')}</span>
                    </div>
                </div>
                <span class="deck-card-time" title="${escapeHtml(toot.created_at)}">${timeStr}</span>
            </div>

            ${cwHtml}
            <div class="deck-card-body ${hasCw ? 'cw-hidden' : ''}">
                ${bodyContent}
                ${mediaHtml}
                ${quoteHtml}
            </div>

            <div class="deck-card-actions">
                <button class="btn-action btn-reply" onclick="openInlineReply('${toot.id}', '@${escapeHtml(acct.acct)}')">
                    💬 <span class="action-count">${toot.replies_count || ''}</span>
                </button>
                <button class="btn-action btn-boost ${toot.reblogged ? 'active' : ''}" id="boost-btn-${toot.id}" onclick="event.stopPropagation(); openBoostPopover('${toot.id}', event)" title="Boost or Quote">
                    🔁 <span class="action-count" id="boost-count-${toot.id}">${toot.reblogs_count || ''}</span>
                </button>
                <button class="btn-action btn-fav ${toot.favourited ? 'active' : ''}" id="fav-btn-${toot.id}" onclick="toggleFav('${toot.id}')" title="Favorite">
                    ⭐ <span class="action-count" id="fav-count-${toot.id}">${toot.favourites_count || ''}</span>
                </button>
                <button class="btn-action btn-bm ${toot.bookmarked ? 'active' : ''}" id="bm-btn-${toot.id}" onclick="toggleBookmark('${toot.id}')" title="Bookmark">
                    🔖
                </button>
                <a href="${escapeHtml(toot.url || '#')}" target="_blank" rel="noopener" class="btn-action btn-ext" title="Open in Mastodon">
                    🔗
                </a>
            </div>

            <div class="deck-reply-box" id="reply-box-${toot.id}" style="display:none;">
                <textarea class="reply-textarea" id="reply-input-${toot.id}" placeholder="Reply to @${escapeHtml(acct.acct)}..."></textarea>

                <div class="compose-media-previews reply-media-previews" id="reply-media-${toot.id}" style="display:none;"></div>
                <div class="compose-upload-status" id="reply-upload-status-${toot.id}" style="display:none;"></div>

                <input type="file" id="reply-file-${toot.id}" multiple accept="image/*,video/*,audio/*" style="display:none;" onchange="handleReplyFileSelect('${toot.id}', event)">

                <div class="reply-footer">
                    <div class="reply-tools">
                        <button type="button" class="btn-tool" id="btn-reply-attach-${toot.id}" onclick="triggerReplyFileSelect('${toot.id}')" title="Attach media">📎 <span id="reply-attach-count-${toot.id}" class="attach-badge" style="display:none;">0</span></button>
                    </div>
                    <div class="reply-actions">
                        <button class="btn btn-secondary btn-xs" onclick="closeInlineReply('${toot.id}')">Cancel</button>
                        <button class="btn btn-primary btn-xs" id="reply-submit-btn-${toot.id}" onclick="submitReply('${toot.id}')">Reply</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderThreadView(container, data, colId) {
    const focal = data.focal || {};
    const ancestors = data.ancestors || [];
    const descendants = data.descendants || [];

    let ancestorsHtml = '';
    if (ancestors.length) {
        ancestorsHtml = `<div class="thread-ancestors-list">` +
            ancestors.map(a => renderTootCard(a, true)).join('') +
        `</div>`;
    }

    let focalHtml = renderFocalTootCard(focal);

    let descendantsHtml = '';
    if (descendants.length) {
        descendantsHtml = `<div class="thread-descendants-list">` +
            descendants.map(d => renderTootCard(d, true)).join('') +
        `</div>`;
    }

    container.innerHTML = `
        <div class="deck-thread-container">
            ${ancestorsHtml}
            ${focalHtml}
            ${descendantsHtml}
        </div>
    `;

    // Initialize reply box under focal toot
    const replyInput = container.querySelector(`#reply-input-${focal.id}`);
    if (replyInput && !replyInput.value.trim()) {
        const acct = focal.account || {};
        replyInput.value = `@${acct.acct} `;
    }
}

function renderFocalTootCard(toot) {
    window.tootsMap = window.tootsMap || {};
    window.tootsMap[toot.id] = toot;

    const acct = toot.account || {};
    const hasCw = Boolean(toot.spoiler_text && toot.spoiler_text.trim());
    const cardId = `focal-${toot.id || Math.random().toString(36).substring(7)}`;

    let reblogHeader = '';
    if (toot.is_reblog && toot.reblogged_by) {
        const rAcc = toot.reblogged_by;
        reblogHeader = `
            <div class="deck-reblog-header">
                <span>🔁 <span class="deck-author-link-inline" onclick="event.stopPropagation(); openUserProfile('${rAcc.id}', '${escapeHtml(rAcc.username || rAcc.acct)}')">${escapeHtml(rAcc.display_name || rAcc.acct)}</span> boosted</span>
            </div>
        `;
    }

    let mediaHtml = '';
    if (toot.media_attachments && toot.media_attachments.length > 0) {
        const count = Math.min(toot.media_attachments.length, 4);
        mediaHtml = `<div class="media-grid media-count-${count}">`;
        toot.media_attachments.slice(0, 4).forEach(m => {
            const url = m.url || m.preview_url;
            mediaHtml += `
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="media-item">
                    <img src="${escapeHtml(m.preview_url || url)}" alt="${escapeHtml(m.description || '')}" loading="lazy">
                </a>
            `;
        });
        mediaHtml += `</div>`;
    }

    let bodyContent = toot.content || '';
    let cwHtml = '';
    if (hasCw) {
        cwHtml = `
            <div class="deck-cw-banner">
                <span>⚠️ ${escapeHtml(toot.spoiler_text)}</span>
                <button class="btn-cw-show" onclick="toggleCardCw('${cardId}')">Show more</button>
            </div>
        `;
    }

    let quoteHtml = '';
    if (toot.quote) {
        quoteHtml = renderQuoteEmbedHtml(toot.quote);
    } else if (toot.card && (!toot.media_attachments || toot.media_attachments.length === 0)) {
        const c = toot.card;
        quoteHtml = `
            <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener" class="deck-link-card" onclick="event.stopPropagation();">
                ${c.image ? `<img src="${escapeHtml(c.image)}" alt="" class="link-card-image">` : ''}
                <div class="link-card-content">
                    <span class="link-card-host">${escapeHtml(c.provider_name || 'Link')}</span>
                    <div class="link-card-title">${escapeHtml(c.title || '')}</div>
                    ${c.description ? `<div class="link-card-desc">${escapeHtml(c.description)}</div>` : ''}
                </div>
            </a>
        `;
    }

    const fullDate = formatFullDate(toot.created_at);

    return `
        <div class="deck-card deck-focal-card" id="${cardId}">
            ${reblogHeader}
            <div class="deck-focal-header">
                <div class="deck-author-link" onclick="event.stopPropagation(); openUserProfile('${acct.id}', '${escapeHtml(acct.username || acct.acct)}')">
                    <img src="${escapeHtml(acct.avatar || '/static/logo.png')}" alt="" class="deck-focal-avatar">
                    <div class="deck-author-meta">
                        <span class="deck-focal-name">${escapeHtml(acct.display_name || acct.username || 'User')}</span>
                        <span class="deck-focal-handle">@${escapeHtml(acct.acct || '')}</span>
                    </div>
                </div>
            </div>

            ${cwHtml}
            <div class="deck-focal-body ${hasCw ? 'cw-hidden' : ''}">
                <div class="deck-focal-text">${bodyContent}</div>
                ${mediaHtml}
                ${quoteHtml}
            </div>

            <div class="deck-focal-date">
                <span>${fullDate}</span>
                <span class="deck-vis-badge">🌐 ${escapeHtml(toot.visibility || 'public')}</span>
            </div>

            <div class="deck-focal-counts">
                <span><strong>${toot.reblogs_count || 0}</strong> Boosts</span>
                <span><strong>${toot.favourites_count || 0}</strong> Favorites</span>
            </div>

            <div class="deck-card-actions deck-focal-actions">
                <button class="btn-action btn-reply" onclick="focusFocalReply('${toot.id}')" title="Reply">
                    💬 <span class="action-count">${toot.replies_count || ''}</span>
                </button>
                <button class="btn-action btn-boost ${toot.reblogged ? 'active' : ''}" id="boost-btn-${toot.id}" onclick="event.stopPropagation(); openBoostPopover('${toot.id}', event)" title="Boost or Quote">
                    🔁 <span class="action-count" id="boost-count-${toot.id}">${toot.reblogs_count || ''}</span>
                </button>
                <button class="btn-action btn-fav ${toot.favourited ? 'active' : ''}" id="fav-btn-${toot.id}" onclick="toggleFav('${toot.id}')" title="Favorite">
                    ⭐ <span class="action-count" id="fav-count-${toot.id}">${toot.favourites_count || ''}</span>
                </button>
                <button class="btn-action btn-bm ${toot.bookmarked ? 'active' : ''}" id="bm-btn-${toot.id}" onclick="toggleBookmark('${toot.id}')" title="Bookmark">
                    🔖
                </button>
                <a href="${escapeHtml(toot.url || '#')}" target="_blank" rel="noopener" class="btn-action btn-ext" title="Open in Mastodon">
                    🔗
                </a>
            </div>

            <div class="deck-reply-box deck-focal-reply-box" id="reply-box-${toot.id}">
                <textarea class="reply-textarea" id="reply-input-${toot.id}" placeholder="Reply to @${escapeHtml(acct.acct)}..."></textarea>

                <div class="compose-media-previews reply-media-previews" id="reply-media-${toot.id}" style="display:none;"></div>
                <div class="compose-upload-status" id="reply-upload-status-${toot.id}" style="display:none;"></div>

                <input type="file" id="reply-file-${toot.id}" multiple accept="image/*,video/*,audio/*" style="display:none;" onchange="handleReplyFileSelect('${toot.id}', event)">

                <div class="reply-footer">
                    <div class="reply-tools">
                        <button type="button" class="btn-tool" id="btn-reply-attach-${toot.id}" onclick="triggerReplyFileSelect('${toot.id}')" title="Attach media">📎 <span id="reply-attach-count-${toot.id}" class="attach-badge" style="display:none;">0</span></button>
                    </div>
                    <div class="reply-actions">
                        <button class="btn btn-primary btn-xs" id="reply-submit-btn-${toot.id}" onclick="submitReply('${toot.id}')">Reply</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function focusFocalReply(tootId) {
    const input = document.getElementById(`reply-input-${tootId}`);
    if (input) input.focus();
}

function formatFullDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
}

function renderNotificationCard(notif) {
    const acct = notif.account || {};
    const type = notif.type || 'notification';
    const timeStr = formatRelativeTime(notif.created_at);

    const typeIcons = {
        favourite: '⭐ Favorited your post',
        reblog: '🔁 Boosted your post',
        mention: '💬 Mentioned you',
        follow: '👥 Followed you',
        poll: '📊 Poll ended',
    };

    const typeLabel = typeIcons[type] || `Notification: ${type}`;
    const statusContent = notif.status ? renderTootCard(notif.status) : '';

    return `
        <div class="deck-card deck-card-notif notif-type-${escapeHtml(type)}">
            <div class="deck-notif-header">
                <span class="notif-badge badge-${escapeHtml(type)}">${typeLabel}</span>
                <span class="deck-card-time">${timeStr}</span>
            </div>
            <div class="deck-card-header">
                <div class="deck-author-link" onclick="event.stopPropagation(); openUserProfile('${acct.id}', '${escapeHtml(acct.username || acct.acct)}')">
                    <img src="${escapeHtml(acct.avatar || '/static/logo.png')}" alt="" class="deck-author-avatar">
                    <div class="deck-author-meta">
                        <span class="deck-author-name">${escapeHtml(acct.display_name || acct.username || 'User')}</span>
                        <span class="deck-author-handle">@${escapeHtml(acct.acct || '')}</span>
                    </div>
                </div>
            </div>
            ${statusContent}
        </div>
    `;
}

function renderUserProfileView(container, profData, statusData, colId) {
    const acc = profData.account || {};
    const rel = profData.relationship || {};
    const statuses = statusData.items || [];

    const fieldsHtml = (acc.fields || []).map(f => `
        <div class="profile-field-row">
            <span class="field-name">${escapeHtml(f.name)}:</span>
            <span class="field-val">${f.value}</span>
        </div>
    `).join('');

    const isFollowing = rel.following;
    const followBtnText = isFollowing ? 'Unfollow' : (rel.requested ? 'Requested' : 'Follow');
    const followBtnClass = isFollowing ? 'btn-secondary' : 'btn-primary';

    const bannerHtml = acc.header ? `<div class="profile-header-banner" style="background-image: url('${escapeHtml(acc.header)}')"></div>` : `<div class="profile-header-banner empty-banner"></div>`;

    const statusesHtml = statuses.length ? statuses.map(t => renderTootCard(t)).join('') : `<div class="deck-empty">No toots found.</div>`;

    container.innerHTML = `
        <div class="deck-profile-view">
            <div class="profile-hero">
                ${bannerHtml}
                <div class="profile-avatar-row">
                    <img src="${escapeHtml(acc.avatar || '/static/logo.png')}" alt="" class="profile-main-avatar">
                    <div class="profile-actions-bar">
                        <button class="btn ${followBtnClass} btn-sm" id="follow-btn-${acc.id}" onclick="toggleFollow('${acc.id}')">
                            ${followBtnText}
                        </button>
                        <a href="${escapeHtml(acc.url || '#')}" target="_blank" rel="noopener" class="btn-action btn-ext" title="Open in Mastodon">🔗</a>
                    </div>
                </div>

                <div class="profile-meta-block">
                    <div class="profile-name-row">
                        <span class="profile-display-name">${escapeHtml(acc.display_name || acc.username)}</span>
                        ${acc.bot ? '<span class="badge-bot">BOT</span>' : ''}
                        ${acc.locked ? '<span class="badge-locked" title="Private account">🔒</span>' : ''}
                    </div>
                    <div class="profile-handle">@${escapeHtml(acc.acct)}</div>

                    ${acc.note ? `<div class="profile-bio">${acc.note}</div>` : ''}

                    ${fieldsHtml ? `<div class="profile-fields-grid">${fieldsHtml}</div>` : ''}

                    <div class="profile-stats-row">
                        <span><strong>${acc.statuses_count || 0}</strong> Posts</span>
                        <span><strong>${acc.following_count || 0}</strong> Following</span>
                        <span><strong>${acc.followers_count || 0}</strong> Followers</span>
                    </div>
                </div>
            </div>

            <div class="profile-statuses-timeline">
                ${statusesHtml}
            </div>
        </div>
    `;
}

async function toggleFollow(accountId) {
    const btn = document.getElementById(`follow-btn-${accountId}`);
    if (!btn) return;
    const currentlyFollowing = btn.textContent.trim() === 'Unfollow';
    const nextAction = currentlyFollowing ? 'unfollow' : 'follow';

    btn.disabled = true;
    try {
        const resp = await fetch(`/api/deck/account/${accountId}/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: nextAction })
        });
        const data = await resp.json();
        if (data.status === 'ok') {
            btn.textContent = data.following ? 'Unfollow' : 'Follow';
            btn.className = `btn ${data.following ? 'btn-secondary' : 'btn-primary'} btn-sm`;
            showToast(data.following ? '👥 Following user!' : '👋 Unfollowed user.');
        } else {
            alert(data.message || 'Follow action failed');
        }
    } catch (e) {
        alert('Follow error: ' + e.message);
    } finally {
        btn.disabled = false;
    }
}

function renderTrendsColumn(container, data) {
    const hashtags = data.hashtags || [];
    const queue = data.queue || [];

    let tagsHtml = hashtags.map(h => `
        <a href="/search?q=${encodeURIComponent('#' + h.hashtag)}" class="deck-hashtag-chip">
            <span class="tag-hash">#</span>${escapeHtml(h.hashtag)}
            <span class="tag-count">${h.count}</span>
        </a>
    `).join('');

    let queueHtml = queue.length ? queue.map(q => `
        <div class="deck-queue-item">
            <div class="queue-item-meta">
                <span>${escapeHtml(q.label)}</span>
                <span>${formatRelativeTime(q.created_at)}</span>
            </div>
            <div class="queue-item-text">${escapeHtml(q.text)}</div>
            <div class="queue-item-actions">
                <a href="/queue" class="btn btn-primary btn-xs">Review in Queue &rarr;</a>
            </div>
        </div>
    `).join('') : '<div class="deck-empty-inline">No pending posts in queue.</div>';

    container.innerHTML = `
        <div class="deck-sub-section">
            <div class="deck-sub-title">
                <span>Trending Hashtags</span>
                <a href="/hashtags" class="deck-sub-link">View all &rarr;</a>
            </div>
            <div class="deck-hashtags-cloud">${tagsHtml || '<div class="deck-empty-inline">No hashtag activity.</div>'}</div>
        </div>

        <div class="deck-sub-section" style="margin-top: 0.75rem;">
            <div class="deck-sub-title">
                <span>Pending Post Queue</span>
                <a href="/queue" class="deck-sub-link">Manage (${queue.length}) &rarr;</a>
            </div>
            <div class="deck-queue-list">${queueHtml}</div>
        </div>
    `;
}

// ── Toot Actions (Favorite, Boost, Bookmark, Reply) ──────────────────────────

async function toggleFav(tootId) {
    const btn = document.getElementById(`fav-btn-${tootId}`);
    const count = document.getElementById(`fav-count-${tootId}`);
    if (!btn) return;

    const currentlyActive = btn.classList.contains('active');
    btn.classList.toggle('active', !currentlyActive);

    try {
        const resp = await fetch(`/api/deck/toot/${tootId}/favourite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: currentlyActive ? 'unfavourite' : 'favourite' })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
            btn.classList.toggle('active', res.favourited);
            if (count && res.favourites_count !== undefined) {
                count.textContent = res.favourites_count || '';
            }
        }
    } catch (e) {
        console.error('Failed to toggle favourite:', e);
        btn.classList.toggle('active', currentlyActive);
    }
}

// ── Boost & Quote Popover & Modal Logic ──────────────────────────────────────
let activeBoostContext = null;
let quoteAttachedMedia = [];

function openBoostPopover(tootId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const toot = (window.tootsMap && window.tootsMap[tootId]) || {};
    const acct = toot.account || {};

    activeBoostContext = {
        tootId: tootId,
        url: toot.url || '',
        authorName: acct.display_name || acct.username || 'User',
        authorHandle: acct.acct || '',
        authorAvatar: acct.avatar || '/static/logo.png',
        content: toot.content || '',
        isBoosted: Boolean(toot.reblogged)
    };

    const popover = document.getElementById('boost-popover-menu');
    const normalText = document.getElementById('boost-menu-normal-text');
    if (!popover) return;

    if (normalText) {
        normalText.textContent = activeBoostContext.isBoosted ? 'Unboost' : 'Boost';
    }

    const rect = event.currentTarget.getBoundingClientRect();
    popover.style.display = 'flex';
    popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popover.style.left = `${Math.max(10, Math.min(window.innerWidth - 180, rect.left + window.scrollX - 40))}px`;
}

function closeBoostPopover() {
    const popover = document.getElementById('boost-popover-menu');
    if (popover) popover.style.display = 'none';
}

document.addEventListener('click', function (e) {
    if (!e.target.closest('#boost-popover-menu') && !e.target.closest('.btn-boost')) {
        closeBoostPopover();
    }
});

async function confirmNormalBoost() {
    closeBoostPopover();
    if (!activeBoostContext) return;
    const { tootId, isBoosted } = activeBoostContext;
    await executeBoost(tootId, isBoosted);
}

async function executeBoost(tootId, currentlyActive) {
    const btn = document.getElementById(`boost-btn-${tootId}`);
    const count = document.getElementById(`boost-count-${tootId}`);

    if (btn) btn.classList.toggle('active', !currentlyActive);

    try {
        const resp = await fetch(`/api/deck/toot/${tootId}/reblog`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: currentlyActive ? 'unreblog' : 'reblog' })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
            if (btn) btn.classList.toggle('active', res.reblogged);
            if (count && res.reblogs_count !== undefined) {
                count.textContent = res.reblogs_count || '';
            }
            if (window.tootsMap && window.tootsMap[tootId]) {
                window.tootsMap[tootId].reblogged = res.reblogged;
                window.tootsMap[tootId].reblogs_count = res.reblogs_count;
            }
            showToast(res.reblogged ? '🔁 Boosted to your profile!' : '↩️ Undo boost');
        } else {
            alert(res.message || 'Failed to boost');
        }
    } catch (e) {
        console.error('Failed to toggle reblog:', e);
        if (btn) btn.classList.toggle('active', currentlyActive);
    }
}

function triggerQuoteModalFromMenu() {
    closeBoostPopover();
    if (!activeBoostContext) return;
    openQuoteModal(activeBoostContext);
}

function openQuoteModal(context) {
    const modal = document.getElementById('deck-quote-modal');
    if (!modal) return;

    const avatarEl = document.getElementById('quote-preview-avatar');
    const nameEl = document.getElementById('quote-preview-name');
    const handleEl = document.getElementById('quote-preview-handle');
    const contentEl = document.getElementById('quote-preview-content');
    const textEl = document.getElementById('quote-compose-text');
    const form = document.getElementById('deck-quote-form');

    if (avatarEl) avatarEl.src = context.authorAvatar || '/static/logo.png';
    if (nameEl) nameEl.textContent = context.authorName || 'User';
    if (handleEl) handleEl.textContent = `@${context.authorHandle || ''}`;
    if (contentEl) contentEl.innerHTML = context.content || '';
    if (textEl) textEl.value = '';

    quoteAttachedMedia = [];
    renderQuoteAttachedMedia();

    modal.style.display = 'flex';

    if (form && !form.dataset.boundPaste) {
        form.dataset.boundPaste = 'true';
        form.addEventListener('paste', handleQuoteClipboardPaste);
    }

    if (textEl) textEl.focus();
}

function closeQuoteModal(e) {
    if (e && e.target && e.target.closest && e.target.closest('.quote-modal-card') && !e.target.closest('.deck-modal-close')) {
        return;
    }
    const modal = document.getElementById('deck-quote-modal');
    if (modal) modal.style.display = 'none';
    quoteAttachedMedia = [];
}

function triggerQuoteFileSelect() {
    const input = document.getElementById('quote-file-input');
    if (input) input.click();
}

function handleQuoteFileSelect(e) {
    if (!e.target || !e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(uploadQuoteMediaFile);
    e.target.value = '';
}

function handleQuoteClipboardPaste(e) {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items || [];
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
            const file = item.getAsFile();
            if (file) {
                hasImage = true;
                uploadQuoteMediaFile(file);
            }
        }
    }

    if (hasImage) {
        showToast('📋 Media pasted into quote!');
    }
}

async function uploadQuoteMediaFile(file) {
    if (quoteAttachedMedia.length >= 4) {
        showToast('⚠️ Maximum 4 attachments allowed.');
        return;
    }

    const statusEl = document.getElementById('quote-upload-status');
    const submitBtn = document.getElementById('quote-submit-btn');

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<span class="spinner"></span> Uploading ${escapeHtml(file.name || 'media')}...`;
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        if (data.status === 'ok' && data.media) {
            quoteAttachedMedia.push(data.media);
            renderQuoteAttachedMedia();
            showToast('✅ Attachment uploaded!');
        } else {
            alert(data.message || 'Media upload failed');
        }
    } catch (err) {
        alert('Upload error: ' + err.message);
    } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

function renderQuoteAttachedMedia() {
    const previewsEl = document.getElementById('quote-media-previews');
    const badgeEl = document.getElementById('quote-attach-count');
    const btnAttach = document.getElementById('btn-quote-attach');

    if (!previewsEl) return;

    if (quoteAttachedMedia.length === 0) {
        previewsEl.style.display = 'none';
        previewsEl.innerHTML = '';
        if (badgeEl) badgeEl.style.display = 'none';
        if (btnAttach) btnAttach.classList.remove('has-media');
        return;
    }

    previewsEl.style.display = 'grid';
    if (badgeEl) {
        badgeEl.textContent = quoteAttachedMedia.length;
        badgeEl.style.display = 'inline-block';
    }
    if (btnAttach) btnAttach.classList.add('has-media');

    previewsEl.innerHTML = quoteAttachedMedia.map((m, idx) => `
        <div class="compose-thumb-item">
            <img src="${escapeHtml(m.preview_url || m.url)}" alt="${escapeHtml(m.description || '')}">
            <button type="button" class="btn-remove-thumb" onclick="removeQuoteMedia(${idx})" title="Remove attachment">✖</button>
        </div>
    `).join('');
}

function renderQuoteEmbedHtml(q) {
    if (!q) return '';
    const qAcc = q.account || {};
    let qMediaHtml = '';
    if (q.media_attachments && q.media_attachments.length > 0) {
        const count = Math.min(q.media_attachments.length, 4);
        qMediaHtml = `<div class="media-grid media-count-${count} quote-media-grid">`;
        q.media_attachments.slice(0, 4).forEach(m => {
            const url = m.url || m.preview_url;
            qMediaHtml += `
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="media-item" onclick="event.stopPropagation();">
                    <img src="${escapeHtml(m.preview_url || url)}" alt="${escapeHtml(m.description || '')}" loading="lazy">
                </a>
            `;
        });
        qMediaHtml += `</div>`;
    }

    const timeStr = formatRelativeTime(q.created_at);

    return `
        <div class="deck-quote-embed deck-card-clickable" onclick="event.stopPropagation(); openTootThread('${q.id}')">
            <div class="deck-quote-header">
                <div class="deck-author-link" onclick="event.stopPropagation(); openUserProfile('${qAcc.id}', '${escapeHtml(qAcc.username || qAcc.acct)}')">
                    <img src="${escapeHtml(qAcc.avatar || '/static/logo.png')}" alt="" class="deck-quote-avatar">
                    <div class="deck-author-meta">
                        <span class="deck-quote-name">${escapeHtml(qAcc.display_name || qAcc.username || 'User')}</span>
                        <span class="deck-quote-handle">@${escapeHtml(qAcc.acct || '')}</span>
                    </div>
                </div>
                <span class="deck-card-time">${timeStr}</span>
            </div>
            <div class="deck-quote-body">
                <div class="deck-quote-text">${q.content || ''}</div>
                ${qMediaHtml}
            </div>
        </div>
    `;
}

function removeQuoteMedia(index) {
    quoteAttachedMedia.splice(index, 1);
    renderQuoteAttachedMedia();
}

async function submitQuoteToot(e) {
    if (e) e.preventDefault();
    if (!activeBoostContext) return;

    const textEl = document.getElementById('quote-compose-text');
    const visEl = document.getElementById('quote-visibility');
    const submitBtn = document.getElementById('quote-submit-btn');

    const commentary = textEl ? textEl.value.trim() : '';
    const mediaIds = quoteAttachedMedia.map(m => m.id);
    const visibility = visEl ? visEl.value : 'public';
    const quotedStatusId = activeBoostContext.tootId;

    if (submitBtn) submitBtn.disabled = true;

    try {
        const resp = await fetch('/api/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: commentary,
                quoted_status_id: quotedStatusId,
                media_ids: mediaIds,
                visibility
            })
        });
        const data = await resp.json();

        if (data.status === 'ok') {
            closeQuoteModal();
            showToast('🚀 Quote toot published!');
            refreshAllColumns();
        } else {
            alert(data.message || 'Failed to post quote');
        }
    } catch (err) {
        alert('Quote error: ' + err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function toggleBookmark(tootId) {
    const btn = document.getElementById(`bm-btn-${tootId}`);
    if (!btn) return;

    const currentlyActive = btn.classList.contains('active');
    btn.classList.toggle('active', !currentlyActive);

    try {
        const resp = await fetch(`/api/deck/toot/${tootId}/bookmark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: currentlyActive ? 'unbookmark' : 'bookmark' })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
            btn.classList.toggle('active', res.bookmarked);
        }
    } catch (e) {
        console.error('Failed to toggle bookmark:', e);
        btn.classList.toggle('active', currentlyActive);
    }
}

let replyAttachedMedia = {};

function openInlineReply(tootId, defaultHandle) {
    const box = document.getElementById(`reply-box-${tootId}`);
    const input = document.getElementById(`reply-input-${tootId}`);
    if (box && input) {
        box.style.display = 'block';
        if (!replyAttachedMedia[tootId]) {
            replyAttachedMedia[tootId] = [];
        }
        if (!input.value.trim()) {
            input.value = `${defaultHandle} `;
        }
        input.focus();

        // Bind paste and drag-drop handlers once per reply box
        if (!input.dataset.boundMedia) {
            input.dataset.boundMedia = 'true';
            input.addEventListener('paste', (e) => handleReplyClipboardPaste(tootId, e));

            box.addEventListener('dragover', (e) => {
                e.preventDefault();
                box.classList.add('drag-over');
            });
            box.addEventListener('dragleave', () => {
                box.classList.remove('drag-over');
            });
            box.addEventListener('drop', (e) => {
                e.preventDefault();
                box.classList.remove('drag-over');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    Array.from(e.dataTransfer.files).forEach(file => uploadReplyMediaFile(tootId, file));
                }
            });
        }
    }
}

function triggerReplyFileSelect(tootId) {
    const input = document.getElementById(`reply-file-${tootId}`);
    if (input) input.click();
}

function handleReplyFileSelect(tootId, e) {
    if (!e.target || !e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(file => uploadReplyMediaFile(tootId, file));
    e.target.value = '';
}

function handleReplyClipboardPaste(tootId, e) {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items || [];
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
            const file = item.getAsFile();
            if (file) {
                hasImage = true;
                uploadReplyMediaFile(tootId, file);
            }
        }
    }

    if (hasImage) {
        showToast('📋 Media pasted into reply!');
    }
}

async function uploadReplyMediaFile(tootId, file) {
    if (!replyAttachedMedia[tootId]) {
        replyAttachedMedia[tootId] = [];
    }
    if (replyAttachedMedia[tootId].length >= 4) {
        showToast('⚠️ Maximum 4 attachments allowed per reply.');
        return;
    }

    const statusEl = document.getElementById(`reply-upload-status-${tootId}`);
    const submitBtn = document.getElementById(`reply-submit-btn-${tootId}`);

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<span class="spinner"></span> Uploading ${escapeHtml(file.name || 'media')}...`;
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        if (data.status === 'ok' && data.media) {
            replyAttachedMedia[tootId].push(data.media);
            renderReplyAttachedMedia(tootId);
            showToast('✅ Attachment uploaded to reply!');
        } else {
            alert(data.message || 'Media upload failed');
        }
    } catch (err) {
        alert('Upload error: ' + err.message);
    } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

function renderReplyAttachedMedia(tootId) {
    const previewsEl = document.getElementById(`reply-media-${tootId}`);
    const badgeEl = document.getElementById(`reply-attach-count-${tootId}`);
    const btnAttach = document.getElementById(`btn-reply-attach-${tootId}`);
    const mediaList = replyAttachedMedia[tootId] || [];

    if (!previewsEl) return;

    if (mediaList.length === 0) {
        previewsEl.style.display = 'none';
        previewsEl.innerHTML = '';
        if (badgeEl) badgeEl.style.display = 'none';
        if (btnAttach) btnAttach.classList.remove('has-media');
        return;
    }

    previewsEl.style.display = 'grid';
    if (badgeEl) {
        badgeEl.textContent = mediaList.length;
        badgeEl.style.display = 'inline-block';
    }
    if (btnAttach) btnAttach.classList.add('has-media');

    previewsEl.innerHTML = mediaList.map((m, idx) => `
        <div class="compose-thumb-item">
            <img src="${escapeHtml(m.preview_url || m.url)}" alt="${escapeHtml(m.description || '')}">
            <button type="button" class="btn-remove-thumb" onclick="removeReplyMedia('${tootId}', ${idx})" title="Remove attachment">✖</button>
            <button type="button" class="btn-alt-thumb ${m.description ? 'has-alt' : ''}" onclick="editReplyMediaAlt('${tootId}', ${idx})" title="${m.description ? 'Edit description' : 'Add image description'}">ALT</button>
        </div>
    `).join('');
}

function removeReplyMedia(tootId, index) {
    if (replyAttachedMedia[tootId]) {
        replyAttachedMedia[tootId].splice(index, 1);
        renderReplyAttachedMedia(tootId);
    }
}

function editReplyMediaAlt(tootId, index) {
    const media = (replyAttachedMedia[tootId] || [])[index];
    if (!media) return;
    const desc = prompt('Enter description (alt text) for this image:', media.description || '');
    if (desc !== null) {
        media.description = desc.trim();
        renderReplyAttachedMedia(tootId);
    }
}

function closeInlineReply(tootId) {
    const box = document.getElementById(`reply-box-${tootId}`);
    if (box) box.style.display = 'none';
}

async function submitReply(tootId) {
    const input = document.getElementById(`reply-input-${tootId}`);
    const mediaIds = (replyAttachedMedia[tootId] || []).map(m => m.id);

    const text = input ? input.value.trim() : '';
    if (!text && mediaIds.length === 0) return;

    try {
        const resp = await fetch('/api/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: text,
                media_ids: mediaIds,
                in_reply_to_id: tootId,
                visibility: 'public'
            })
        });
        const data = await resp.json();
        if (data.status === 'ok') {
            closeInlineReply(tootId);
            if (input) input.value = '';
            delete replyAttachedMedia[tootId];
            showToast('💬 Reply published!');
            refreshAllColumns();
        } else {
            alert(data.message || 'Failed to post reply');
        }
    } catch (e) {
        alert('Reply request failed: ' + e.message);
    }
}

function toggleCardCw(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const body = card.querySelector('.deck-card-body');
    const btn = card.querySelector('.btn-cw-show');
    if (body && btn) {
        const isHidden = body.classList.toggle('cw-hidden');
        btn.textContent = isHidden ? 'Show more' : 'Show less';
    }
}

// ── Column Management (Move, Resize, Close, Add) ─────────────────────────────

function moveColumn(colId, direction) {
    const index = deckColumns.findIndex(c => c.id === colId);
    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 1 || newIndex >= deckColumns.length) return;

    const col = deckColumns.splice(index, 1)[0];
    deckColumns.splice(newIndex, 0, col);
    saveColumns();
    renderColumns();
}

function cycleColumnWidth(colId) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;

    const currentWidth = col.width || 360;
    const curIdx = DEFAULT_WIDTHS.indexOf(currentWidth);
    const nextWidth = DEFAULT_WIDTHS[(curIdx + 1) % DEFAULT_WIDTHS.length];

    col.width = nextWidth;
    saveColumns();

    const colEl = document.getElementById(colId);
    if (colEl) {
        colEl.style.flex = `0 0 ${nextWidth}px`;
        colEl.style.width = `${nextWidth}px`;
        colEl.style.minWidth = `${nextWidth}px`;
        colEl.style.maxWidth = `${nextWidth}px`;
    }
}

function removeColumn(colId) {
    deckColumns = deckColumns.filter(c => c.id !== colId);
    saveColumns();
    renderColumns();
}

function refreshColumn(colId) {
    const col = deckColumns.find(c => c.id === colId);
    if (col) fetchColumnData(col);
}

function refreshAllColumns() {
    deckColumns.forEach(col => {
        if (col.type !== 'compose') fetchColumnData(col);
    });
}

function setNotifFilter(colId, filter) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.filter = filter;

    const bar = document.querySelector(`.deck-filter-bar[data-col-id="${colId}"]`);
    if (bar) {
        bar.querySelectorAll('.deck-pill').forEach(btn => btn.classList.remove('active'));
        const activeBtn = Array.from(bar.querySelectorAll('.deck-pill')).find(btn => {
            const onclickStr = btn.getAttribute('onclick') || '';
            return onclickStr.includes(`'${filter}'`);
        });
        if (activeBtn) activeBtn.classList.add('active');
    }

    fetchColumnData(col);
}

function setPublicScope(colId, isLocal) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.local = Boolean(isLocal);
    saveColumns();
    renderColumns();
}

function setArchiveFilter(colId, filter) {
    const col = deckColumns.find(c => c.id === colId);
    if (!col) return;
    col.filter = filter;
    fetchColumnData(col);
}

// ── Add Column Modal ─────────────────────────────────────────────────────────

function openAddColumnModal() {
    let modal = document.getElementById('modal-add-column');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-add-column';
        modal.className = 'deck-modal-backdrop';
        modal.innerHTML = `
            <div class="deck-modal-card">
                <div class="deck-modal-header">
                    <h3>➕ Add New Deck Column</h3>
                    <button class="deck-modal-close" onclick="closeAddColumnModal()">✖</button>
                </div>
                <div class="deck-modal-body">
                    <div class="modal-form-group">
                        <label>Choose Feed Type:</label>
                        <select id="modal-col-type" class="modal-select" onchange="onModalTypeChange()">
                            <option value="home">🏠 Home Timeline (People you follow)</option>
                            <option value="hashtag">🏷️ Hashtag Tracker (Track specific #tag)</option>
                            <option value="public">🌐 Federated / Local Public Timeline</option>
                            <option value="notifications">🔔 Notifications</option>
                            <option value="favorites">⭐ Favorites</option>
                            <option value="bookmarks">🔖 Bookmarks</option>
                            <option value="archive">💬 Your Toots Archive</option>
                            <option value="trends">📊 Trending Hashtags & Queue</option>
                        </select>
                    </div>

                    <div class="modal-form-group" id="modal-hashtag-wrap" style="display:none;">
                        <label>Hashtag name:</label>
                        <div class="input-prefix-wrap">
                            <span class="input-prefix">#</span>
                            <input type="text" id="modal-hashtag-input" class="modal-input" placeholder="e.g. selfhosted, f1, tech">
                        </div>
                    </div>

                    <div class="modal-form-group">
                        <label>Column Width:</label>
                        <select id="modal-col-width" class="modal-select">
                            <option value="300">Compact (300px)</option>
                            <option value="360" selected>Standard (360px)</option>
                            <option value="440">Wide (440px)</option>
                        </select>
                    </div>
                </div>
                <div class="deck-modal-footer">
                    <button class="btn btn-secondary btn-sm" onclick="closeAddColumnModal()">Cancel</button>
                    <button class="btn btn-primary btn-sm" onclick="confirmAddColumn()">Add Column</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
}

function closeAddColumnModal() {
    const modal = document.getElementById('modal-add-column');
    if (modal) modal.style.display = 'none';
}

function onModalTypeChange() {
    const select = document.getElementById('modal-col-type');
    const wrap = document.getElementById('modal-hashtag-wrap');
    if (select && wrap) {
        wrap.style.display = select.value === 'hashtag' ? 'block' : 'none';
    }
}

function confirmAddColumn() {
    const typeSelect = document.getElementById('modal-col-type');
    const widthSelect = document.getElementById('modal-col-width');
    const tagInput = document.getElementById('modal-hashtag-input');
    if (!typeSelect) return;

    const type = typeSelect.value;
    const width = parseInt(widthSelect.value, 10) || 360;
    const newId = `col-${type}-${Date.now()}`;

    let title = 'Feed';
    let tag = '';

    if (type === 'home') title = 'Home';
    else if (type === 'notifications') title = 'Notifications';
    else if (type === 'public') title = 'Public Timeline';
    else if (type === 'favorites') title = 'Favorites';
    else if (type === 'bookmarks') title = 'Bookmarks';
    else if (type === 'archive') title = 'My Archive';
    else if (type === 'trends') title = 'Trends & Queue';
    else if (type === 'hashtag') {
        tag = (tagInput ? tagInput.value : '').replace(/^#/, '').trim();
        if (!tag) {
            alert('Please enter a hashtag name.');
            return;
        }
        title = `# ${tag}`;
    }

    const colObj = {
        type,
        id: newId,
        title,
        tag,
        width,
        filter: type === 'archive' ? 'all' : ''
    };

    if (type === 'hashtag') {
        colObj.localOnly = false;
        colObj.includeAdditional = false;
        colObj.anyTags = [];
        colObj.allTags = [];
        colObj.noneTags = [];
        colObj.settingsOpen = false;
    }

    deckColumns.push(colObj);

    saveColumns();
    closeAddColumnModal();
    renderColumns();
}

function resetDeckLayout() {
    if (confirm('Reset your Deck layout back to default columns?')) {
        deckColumns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
        saveColumns();
        renderColumns();
    }
}

// ── Compose & Media Upload Helpers ───────────────────────────────────────────

let attachedMedia = [];

function triggerFileSelect() {
    const input = document.getElementById('compose-file-input');
    if (input) input.click();
}

function handleFileSelect(e) {
    if (!e.target || !e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(uploadMediaFile);
    e.target.value = '';
}

function handleClipboardPaste(e) {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items || [];
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
            const file = item.getAsFile();
            if (file) {
                hasImage = true;
                uploadMediaFile(file);
            }
        }
    }

    if (hasImage) {
        showToast('📋 Media pasted from clipboard!');
    }
}

async function uploadMediaFile(file) {
    if (attachedMedia.length >= 4) {
        showToast('⚠️ Maximum 4 attachments allowed per toot.');
        return;
    }

    const statusEl = document.getElementById('compose-upload-status');
    const submitBtn = document.getElementById('compose-submit-btn');

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<span class="spinner"></span> Uploading ${escapeHtml(file.name || 'media')}...`;
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        if (data.status === 'ok' && data.media) {
            attachedMedia.push(data.media);
            renderAttachedMedia();
            showToast('✅ Attachment uploaded!');
        } else {
            alert(data.message || 'Media upload failed');
        }
    } catch (err) {
        alert('Upload error: ' + err.message);
    } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

function renderAttachedMedia() {
    const previewsEl = document.getElementById('compose-media-previews');
    const badgeEl = document.getElementById('attach-count');
    const btnAttach = document.getElementById('btn-attach-media');

    if (!previewsEl) return;

    if (attachedMedia.length === 0) {
        previewsEl.style.display = 'none';
        previewsEl.innerHTML = '';
        if (badgeEl) badgeEl.style.display = 'none';
        if (btnAttach) btnAttach.classList.remove('has-media');
        return;
    }

    previewsEl.style.display = 'grid';
    if (badgeEl) {
        badgeEl.textContent = attachedMedia.length;
        badgeEl.style.display = 'inline-block';
    }
    if (btnAttach) btnAttach.classList.add('has-media');

    previewsEl.innerHTML = attachedMedia.map((m, idx) => `
        <div class="compose-thumb-item">
            <img src="${escapeHtml(m.preview_url || m.url)}" alt="${escapeHtml(m.description || '')}">
            <button type="button" class="btn-remove-thumb" onclick="removeAttachedMedia(${idx})" title="Remove attachment">✖</button>
            <button type="button" class="btn-alt-thumb ${m.description ? 'has-alt' : ''}" onclick="editMediaAlt(${idx})" title="${m.description ? 'Edit description' : 'Add image description'}">ALT</button>
        </div>
    `).join('');
}

function removeAttachedMedia(index) {
    attachedMedia.splice(index, 1);
    renderAttachedMedia();
}

function editMediaAlt(index) {
    const media = attachedMedia[index];
    if (!media) return;
    const desc = prompt('Enter description (alt text) for this image:', media.description || '');
    if (desc !== null) {
        media.description = desc.trim();
        renderAttachedMedia();
    }
}

function toggleCW() {
    const box = document.getElementById('compose-cw-box');
    const btn = document.getElementById('btn-cw-toggle');
    if (box && btn) {
        const isShown = box.style.display !== 'none';
        box.style.display = isShown ? 'none' : 'block';
        btn.classList.toggle('active', !isShown);
        if (!isShown) {
            const input = document.getElementById('compose-spoiler');
            if (input) input.focus();
        }
    }
}

function updateCharCount() {
    const textarea = document.getElementById('compose-text');
    const counter = document.getElementById('compose-chars');
    if (textarea && counter) {
        const remaining = 500 - textarea.value.length;
        counter.textContent = remaining;
        counter.style.color = remaining < 50 ? 'var(--red)' : 'var(--text-muted)';
    }
}

async function submitDeckToot(e) {
    if (e) e.preventDefault();
    const textEl = document.getElementById('compose-text');
    const spoilerEl = document.getElementById('compose-spoiler');
    const cwBox = document.getElementById('compose-cw-box');
    const visEl = document.getElementById('compose-visibility');
    const feedbackEl = document.getElementById('compose-feedback');
    const submitBtn = document.getElementById('compose-submit-btn');

    const status = textEl ? textEl.value.trim() : '';
    const mediaIds = attachedMedia.map(m => m.id);

    if (!status && mediaIds.length === 0) return;

    const spoiler = (cwBox && cwBox.style.display !== 'none' && spoilerEl) ? spoilerEl.value.trim() : '';
    const visibility = visEl ? visEl.value : 'public';

    if (submitBtn) submitBtn.disabled = true;

    try {
        const resp = await fetch('/api/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                media_ids: mediaIds,
                spoiler_text: spoiler || undefined,
                sensitive: Boolean(spoiler),
                visibility
            })
        });
        const data = await resp.json();

        if (data.status === 'ok') {
            if (textEl) textEl.value = '';
            if (spoilerEl) spoilerEl.value = '';
            attachedMedia = [];
            renderAttachedMedia();
            updateCharCount();
            if (feedbackEl) {
                feedbackEl.className = 'compose-feedback success';
                feedbackEl.textContent = '🚀 Toot published!';
                feedbackEl.style.display = 'block';
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);
            }
            refreshAllColumns();
        } else {
            if (feedbackEl) {
                feedbackEl.className = 'compose-feedback error';
                feedbackEl.textContent = data.message || 'Failed to post';
                feedbackEl.style.display = 'block';
            }
        }
    } catch (err) {
        if (feedbackEl) {
            feedbackEl.className = 'compose-feedback error';
            feedbackEl.textContent = 'Error: ' + err.message;
            feedbackEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffSecs = Math.floor((now - date) / 1000);

        if (diffSecs < 60) return `${Math.max(1, diffSecs)}s`;
        if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
        if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h`;
        if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initDeck);

