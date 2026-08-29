async function triggerSync() {
    const btn = document.querySelector('.btn-sync');
    const statusEl = document.getElementById('sync-status');

    btn.disabled = true;
    btn.textContent = 'Syncing...';
    statusEl.style.display = 'block';
    statusEl.className = 'sync-status running';
    statusEl.textContent = 'Sync started. This may take a moment...';

    try {
        const response = await fetch('/api/sync', { method: 'POST' });
        const data = await response.json();

        if (data.status === 'already_running') {
            statusEl.textContent = 'A sync is already running. Please wait.';
        } else {
            statusEl.textContent = 'Sync started! The page will refresh shortly.';
            setTimeout(() => location.reload(), 10000);
        }
        statusEl.className = 'sync-status done';
    } catch (err) {
        statusEl.textContent = 'Sync request failed: ' + err.message;
        statusEl.className = 'sync-status';
        statusEl.style.borderColor = 'var(--red)';
        statusEl.style.color = 'var(--red)';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sync Now';
    }
}

async function regenerateRoast() {
    const btn = document.getElementById('roast-btn');
    const text = document.getElementById('roast-text');

    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const response = await fetch('/api/roast', { method: 'POST' });
        const data = await response.json();

        if (data.roast) {
            text.textContent = data.roast;
        } else {
            text.textContent = 'AI could not generate a roast. Check your API settings.';
        }
    } catch (err) {
        text.textContent = 'Failed to generate roast: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Roast Me Again';
    }
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast show';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.className = 'toast'; }, 2500);
}

async function rateRoast(rating) {
    const likeBtn = document.getElementById('roast-like-btn');
    const dislikeBtn = document.getElementById('roast-dislike-btn');
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;
    await fetch('/api/roast/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
    });
    if (rating === 1) {
        likeBtn.textContent = '✅';
        showToast('👍 Feedback saved!');
    } else {
        dislikeBtn.textContent = '❌';
        showToast('👎 Feedback saved!');
    }
}

function tootRoast(instanceUrl) {
    const text = document.getElementById('roast-text').textContent.trim() + '\n\nRoasted by Mastoferr\nhttps://github.com/brunopatuleia/MastoFerr';
    const url = instanceUrl.replace(/\/$/, '') + '/share?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
}

async function checkVersion() {
    const container = document.getElementById('version-check');
    if (!container) return;

    try {
        const response = await fetch('/api/version');
        const data = await response.json();

        if (data.update_available) {
            container.replaceChildren();
            const box = document.createElement('div');
            box.style.cssText = 'margin-top: 10px; padding: 10px; border: 1px solid var(--accent); border-radius: 6px; background: rgba(255,255,255,0.05);';
            const strong = document.createElement('strong');
            strong.style.color = 'var(--accent)';
            strong.textContent = `Update available: v${data.latest}`;
            const small = document.createElement('small');
            small.append(document.createTextNode(`You are on v${data.current}. `));
            const link = document.createElement('a');
            link.href = 'https://github.com/brunopatuleia/mastoferr';
            link.target = '_blank';
            link.rel = 'noopener';
            link.style.cssText = 'color: inherit; text-decoration: underline;';
            link.textContent = 'View on GitHub';
            small.appendChild(link);
            box.append(strong, document.createElement('br'), small);
            container.appendChild(box);
        } else if (data.latest) {
            container.replaceChildren();
            const small = document.createElement('small');
            small.style.cssText = 'color: var(--green); display: block; margin-top: 5px;';
            small.textContent = `You are up to date (v${data.current})`;
            container.appendChild(small);
        }
    } catch (err) {
        console.error('Failed to check version:', err);
    }
}

document.addEventListener('DOMContentLoaded', checkVersion);

// Responsive Sidebar & Navigation Controller
(function () {
    const hamburgerBtn = document.getElementById('nav-hamburger');
    const mobileTrigger = document.getElementById('mobile-hamburger');
    const sidebar = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    // Restore desktop collapsed state from localStorage
    const isMobile = () => window.innerWidth <= 900;
    if (!isMobile() && localStorage.getItem('mastoferr_sidebar_collapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
    }

    function toggleDesktopCollapse() {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('mastoferr_sidebar_collapsed', isCollapsed);
    }

    function toggleMobileDrawer() {
        const open = sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active', open);
        document.body.classList.toggle('no-scroll', open);
    }

    function closeMobileDrawer() {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isMobile()) {
                toggleMobileDrawer();
            } else {
                toggleDesktopCollapse();
            }
        });
    }

    if (mobileTrigger) {
        mobileTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMobileDrawer();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeMobileDrawer);
    }

    // Close mobile drawer when clicking any sidebar link
    sidebar.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) closeMobileDrawer();
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeMobileDrawer();
        }
    });

    // Handle resize transitions
    window.addEventListener('resize', function () {
        if (!isMobile() && sidebar.classList.contains('open')) {
            closeMobileDrawer();
        }
    });
}());

// ── Global In-App Media Lightbox Controller ──────────────────────────────────
let lightboxItems = [];
let lightboxCurrentIndex = 0;

function openLightbox(items, startIndex = 0) {
    if (!items || !items.length) return;
    lightboxItems = items;
    lightboxCurrentIndex = Math.max(0, Math.min(startIndex, items.length - 1));

    const modal = document.getElementById('media-lightbox');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.classList.add('lightbox-open');
    renderLightboxItem();
}

function closeLightbox(e) {
    if (e && e.target && e.target.closest && e.target.closest('.lightbox-dialog') && !e.target.closest('.lightbox-close')) {
        return;
    }
    const modal = document.getElementById('media-lightbox');
    const video = document.getElementById('lightbox-video');
    if (video) {
        video.pause();
        video.src = '';
    }
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('lightbox-open');
}

function navigateLightbox(direction) {
    if (!lightboxItems.length) return;
    lightboxCurrentIndex = (lightboxCurrentIndex + direction + lightboxItems.length) % lightboxItems.length;
    renderLightboxItem();
}

function renderLightboxItem() {
    const item = lightboxItems[lightboxCurrentIndex];
    if (!item) return;

    const imgEl = document.getElementById('lightbox-img');
    const videoEl = document.getElementById('lightbox-video');
    const captionEl = document.getElementById('lightbox-caption');
    const descEl = document.getElementById('lightbox-desc');
    const counterEl = document.getElementById('lightbox-counter');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    const isVideo = item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm|mov)$/i));

    if (isVideo) {
        if (imgEl) imgEl.style.display = 'none';
        if (videoEl) {
            videoEl.src = item.url;
            videoEl.style.display = 'block';
            videoEl.play().catch(() => {});
        }
    } else {
        if (videoEl) {
            videoEl.pause();
            videoEl.style.display = 'none';
            videoEl.src = '';
        }
        if (imgEl) {
            imgEl.src = item.url || item.preview_url;
            imgEl.alt = item.description || '';
            imgEl.style.display = 'block';
        }
    }

    if (prevBtn && nextBtn) {
        const hasMultiple = lightboxItems.length > 1;
        prevBtn.style.display = hasMultiple ? 'flex' : 'none';
        nextBtn.style.display = hasMultiple ? 'flex' : 'none';
    }

    const hasDesc = Boolean(item.description && item.description.trim());
    if (captionEl) {
        if (hasDesc || lightboxItems.length > 1) {
            captionEl.style.display = 'flex';
            if (descEl) descEl.textContent = item.description || '';
            if (counterEl) {
                counterEl.textContent = lightboxItems.length > 1 ? `${lightboxCurrentIndex + 1} / ${lightboxItems.length}` : '';
            }
        } else {
            captionEl.style.display = 'none';
        }
    }
}

// Global Click Interceptor for Media Items
document.addEventListener('click', function (e) {
    const mediaItem = e.target.closest('.media-item');
    if (!mediaItem) return;

    e.preventDefault();
    e.stopPropagation();

    const grid = mediaItem.closest('.media-grid');
    const items = [];
    let activeIndex = 0;

    if (grid) {
        const mediaElements = Array.from(grid.querySelectorAll('.media-item'));
        mediaElements.forEach((el, idx) => {
            if (el === mediaItem) activeIndex = idx;
            const img = el.querySelector('img');
            const vid = el.querySelector('video');
            const fullUrl = el.getAttribute('href') || el.dataset.fullUrl || (img ? img.src : (vid ? vid.src : ''));
            const desc = img ? img.alt : (el.dataset.description || '');
            const isVideo = Boolean(vid || (fullUrl && fullUrl.match(/\.(mp4|webm|mov)$/i)));
            items.push({
                url: fullUrl,
                preview_url: img ? img.src : fullUrl,
                type: isVideo ? 'video' : 'image',
                description: desc
            });
        });
    } else {
        const img = mediaItem.querySelector('img');
        const vid = mediaItem.querySelector('video');
        const fullUrl = mediaItem.getAttribute('href') || (img ? img.src : (vid ? vid.src : ''));
        const desc = img ? img.alt : '';
        const isVideo = Boolean(vid || (fullUrl && fullUrl.match(/\.(mp4|webm|mov)$/i)));
        items.push({
            url: fullUrl,
            type: isVideo ? 'video' : 'image',
            description: desc
        });
    }

    if (items.length) {
        openLightbox(items, activeIndex);
    }
});

// Keyboard Navigation for Lightbox
document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('media-lightbox');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape') {
        closeLightbox();
    } else if (e.key === 'ArrowLeft') {
        navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
        navigateLightbox(1);
    }
});
