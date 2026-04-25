/**
 * PULSE — Social Feed App
 * Vanilla JS · localStorage persistence · No frameworks
 */

/* ══════════════════════════════════════════════════
   CONSTANTS & STATE
══════════════════════════════════════════════════ */

const CURRENT_USER = 'You';
const PAGE_SIZE     = 8;
const BLOCKED_WORDS = ['badword1', 'badword2', 'offensive', 'banned'];

const FAKE_USERS = [
  { name: 'Alex Kim',    handle: '@alexkim',   color: '#6366f1', initial: 'A' },
  { name: 'Sarah O',     handle: '@sarahoo',   color: '#ec4899', initial: 'S' },
  { name: 'Marco R',     handle: '@marcor',    color: '#f59e0b', initial: 'M' },
  { name: 'Priya D',     handle: '@priyadev',  color: '#10b981', initial: 'P' },
  { name: 'Liam T',      handle: '@liamtx',    color: '#3b82f6', initial: 'L' },
];

let posts         = loadFromStorage('posts', []);
let notifications = loadFromStorage('notifications', []);
let stories       = loadFromStorage('stories', []);
let seenStories   = loadFromStorage('seenStories', []);
let darkMode      = loadFromStorage('darkMode', false);
let feedMode      = 'chronological';    // 'chronological' | 'algorithmic'
let activeSearch  = '';
let activeHashtag = '';
let loadedCount   = PAGE_SIZE;
let imageDataURL  = null;

/* ══════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
══════════════════════════════════════════════════ */

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('Storage error', e); }
}

function syncPosts()         { saveToStorage('posts', posts); }
function syncNotifications() { saveToStorage('notifications', notifications); }
function syncStories()       { saveToStorage('stories', stories); }
function syncSeenStories()   { saveToStorage('seenStories', seenStories); }

/* ══════════════════════════════════════════════════
   ID / TIME HELPERS
══════════════════════════════════════════════════ */

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

/* ══════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════ */

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.add('hidden'), 300); }, 2800);
}

/* ══════════════════════════════════════════════════
   DARK MODE
══════════════════════════════════════════════════ */

function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.getElementById('themeToggle').textContent = darkMode ? '☀️' : '🌙';
}

/* ══════════════════════════════════════════════════
   CONTENT MODERATION
══════════════════════════════════════════════════ */

function hasBadWords(text) {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some(w => lower.includes(w));
}

/* ══════════════════════════════════════════════════
   HASHTAG PARSING
══════════════════════════════════════════════════ */

/** Converts #tags in text into clickable spans */
function renderHashtags(text) {
  return text.replace(/(#[a-zA-Z0-9_]+)/g, (match) => {
    return `<span class="hashtag" data-tag="${match}">${match}</span>`;
  });
}

/** Extract all hashtags from all posts */
function extractTrends() {
  const counts = {};
  posts.forEach(p => {
    const tags = (p.content.match(/#[a-zA-Z0-9_]+/g) || []);
    tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
}

/* ══════════════════════════════════════════════════
   STORIES
══════════════════════════════════════════════════ */

const STORY_TEXTS = [
  '✨ Good vibes only today!',
  '🚀 Just launched something big',
  '🌅 Morning walk, grateful for today',
  '🎵 This song is on repeat',
  '📚 Reading something life-changing',
];

function initStories() {
  // Prune stories older than 24h (simulated as 24 * 60 * 60 * 1000 ms)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  stories = stories.filter(s => s.createdAt > cutoff);

  // Seed fake stories if empty
  if (stories.length === 0) {
    stories = FAKE_USERS.map((u, i) => ({
      id: genId(),
      username: u.name,
      color: u.color,
      initial: u.initial,
      text: STORY_TEXTS[i],
      createdAt: Date.now() - i * 3 * 60 * 60 * 1000, // space them out
    }));
    syncStories();
  }
  renderStories();
}

function renderStories() {
  const bar = document.getElementById('storiesBar');
  bar.innerHTML = '';
  stories.forEach(s => {
    const seen = seenStories.includes(s.id);
    const item = document.createElement('div');
    item.className = 'story-item';
    item.innerHTML = `
      <div class="story-ring ${seen ? 'seen' : ''}">
        <div class="story-avatar-inner" style="background:${s.color};color:white">${s.initial}</div>
      </div>
      <span class="story-name">${s.username.split(' ')[0]}</span>
    `;
    item.addEventListener('click', () => openStory(s));
    bar.appendChild(item);
  });
}

let storyTimer = null;
function openStory(story) {
  const modal   = document.getElementById('storyModal');
  const content = document.getElementById('storyContent');
  const fill    = document.getElementById('storyProgressFill');

  content.textContent = story.text;
  content.style.background = story.color + '22';
  fill.style.width = '0%';
  modal.classList.remove('hidden');

  // Mark seen
  if (!seenStories.includes(story.id)) {
    seenStories.push(story.id);
    syncSeenStories();
    renderStories();
  }

  clearTimeout(storyTimer);
  requestAnimationFrame(() => { fill.style.width = '100%'; });
  storyTimer = setTimeout(() => closeStory(), 5100);
}

function closeStory() {
  document.getElementById('storyModal').classList.add('hidden');
  document.getElementById('storyProgressFill').style.width = '0%';
  clearTimeout(storyTimer);
}

/* ══════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════ */

function addNotification(msg) {
  notifications.unshift({ id: genId(), msg, ts: Date.now() });
  if (notifications.length > 30) notifications = notifications.slice(0, 30);
  syncNotifications();
  updateNotifBadge();
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (notifications.length > 0) {
    badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  if (notifications.length === 0) {
    list.innerHTML = '<p class="notif-empty">No notifications yet</p>';
    return;
  }
  list.innerHTML = '';
  notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `<div>${n.msg}</div><div class="notif-time">${timeAgo(n.ts)}</div>`;
    list.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════ */

function updateAnalytics() {
  // Top post by likes
  let topPost = posts.reduce((a, b) => (b.likes > (a ? a.likes : -1) ? b : a), null);
  document.getElementById('analyticsTopPost').textContent =
    topPost ? `"${topPost.content.slice(0, 28)}…" (${topPost.likes} ❤)` : '—';

  // Most active commenter
  const commenters = {};
  posts.forEach(p => p.comments.forEach(c => {
    if (c.username !== CURRENT_USER) commenters[c.username] = (commenters[c.username] || 0) + 1;
  }));
  const topCommenter = Object.entries(commenters).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('analyticsTopCommenter').textContent = topCommenter ? `${topCommenter[0]} (${topCommenter[1]})` : '—';

  document.getElementById('analyticsTotalPosts').textContent = posts.length;
  document.getElementById('analyticsTotalLikes').textContent = posts.reduce((sum, p) => sum + p.likes, 0);
}

/* ══════════════════════════════════════════════════
   TRENDS SIDEBAR
══════════════════════════════════════════════════ */

function renderTrends() {
  const list   = document.getElementById('trendsList');
  const trends = extractTrends();
  if (trends.length === 0) {
    list.innerHTML = '<li class="trends-empty">No hashtags yet</li>';
    return;
  }
  list.innerHTML = '';
  trends.forEach(([tag, count]) => {
    const li = document.createElement('li');
    li.className = 'trend-item';
    li.innerHTML = `<span class="trend-tag">${tag}</span><span class="trend-count">${count}</span>`;
    li.querySelector('.trend-tag').addEventListener('click', () => filterByHashtag(tag));
    list.appendChild(li);
  });
}

/* ══════════════════════════════════════════════════
   SUGGESTED USERS
══════════════════════════════════════════════════ */

function renderSuggested() {
  const list = document.getElementById('suggestList');
  list.innerHTML = '';
  FAKE_USERS.slice(0, 4).forEach(u => {
    const li = document.createElement('li');
    li.className = 'suggest-item';
    li.innerHTML = `
      <div class="suggest-avatar" style="background:${u.color}">${u.initial}</div>
      <div class="suggest-info">
        <div class="suggest-name">${u.name}</div>
        <div class="suggest-handle">${u.handle}</div>
      </div>
      <button class="suggest-follow">Follow</button>
    `;
    li.querySelector('.suggest-follow').addEventListener('click', (e) => {
      e.target.textContent = 'Following ✓';
      e.target.style.color = '#16a34a';
      showToast(`Following ${u.name}!`);
    });
    list.appendChild(li);
  });
}

/* ══════════════════════════════════════════════════
   FEED FILTERING & SORTING
══════════════════════════════════════════════════ */

/** Get the filtered + sorted subset of posts to display */
function getVisiblePosts() {
  let result = [...posts];

  // Filter by hashtag
  if (activeHashtag) {
    result = result.filter(p => p.content.toLowerCase().includes(activeHashtag.toLowerCase()));
  }

  // Filter by search
  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    result = result.filter(p =>
      p.content.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.content.match(/#[a-zA-Z0-9_]+/g) || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // Pinned first
  result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  // Sort by mode (within pinned/unpinned buckets)
  if (feedMode === 'algorithmic') {
    result.sort((a, b) => {
      // Keep pinned at top
      if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      const scoreA = a.likes * 3 + a.comments.length * 2 + (Date.now() - a.timestamp < 3600000 ? 5 : 0);
      const scoreB = b.likes * 3 + b.comments.length * 2 + (Date.now() - b.timestamp < 3600000 ? 5 : 0);
      return scoreB - scoreA;
    });
  } else {
    // Chronological within each bucket
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return b.timestamp - a.timestamp;
    });
  }

  return result;
}

/* ══════════════════════════════════════════════════
   RENDER FEED
══════════════════════════════════════════════════ */

/** Re-renders the entire feed from the posts array */
function renderFeed() {
  const container = document.getElementById('feed');
  const empty     = document.getElementById('feedEmpty');
  const label     = document.getElementById('feedModeLabel');
  const countEl   = document.getElementById('feedCount');

  const visible = getVisiblePosts();
  const slice   = visible.slice(0, loadedCount);

  label.textContent = feedMode === 'algorithmic' ? '⚡ Algorithmic feed' : '🕒 Chronological feed';
  countEl.textContent = `${visible.length} post${visible.length !== 1 ? 's' : ''}`;

  // Preserve open comment sections
  const openComments = new Set();
  container.querySelectorAll('.comments-section.open').forEach(el => {
    openComments.add(el.closest('.post-card')?.dataset.id);
  });

  container.innerHTML = '';

  if (slice.length === 0) {
    empty.classList.remove('hidden');
    container.appendChild(empty);
    return;
  }
  empty.classList.add('hidden');

  slice.forEach(post => {
    const card = buildPostCard(post, openComments.has(post.id));
    container.appendChild(card);
  });

  renderTrends();
  updateAnalytics();
}

/* ══════════════════════════════════════════════════
   BUILD POST CARD DOM
══════════════════════════════════════════════════ */

function buildPostCard(post, commentsOpen = false) {
  const isOwn     = post.username === CURRENT_USER;
  const hasLiked  = (post.likedBy || []).includes(CURRENT_USER);
  const card      = document.createElement('div');
  card.className  = `post-card${post.pinned ? ' pinned' : ''}`;
  card.dataset.id = post.id;

  // ── Header ──
  const initial = post.username === CURRENT_USER ? 'Y' : post.username[0].toUpperCase();
  const avatarBg = post.username === CURRENT_USER ? 'var(--accent)' : (FAKE_USERS.find(u => u.name === post.username)?.color || '#888');

  let headerHTML = `
    <div class="post-header">
      <div class="avatar" style="background:${avatarBg};color:white;">${initial}</div>
      <div class="post-user-info">
        <div class="post-username">${post.username}${post.pinned ? ' <span class="post-badge">📌 Pinned</span>' : ''}</div>
        <div class="post-time">${timeAgo(post.timestamp)}</div>
      </div>
      <div class="post-actions-top">
  `;

  if (isOwn) {
    headerHTML += `
      <button class="post-action-btn pin-btn${post.pinned ? ' pin-active' : ''}" data-id="${post.id}">
        ${post.pinned ? '📌 Unpin' : '📌 Pin'}
      </button>
      <button class="post-action-btn danger delete-btn" data-id="${post.id}">🗑 Delete</button>
    `;
  }
  headerHTML += `
      <button class="post-action-btn repost repost-btn" data-id="${post.id}">♻ Repost</button>
    </div>
  </div>`;

  // ── Body ──
  let bodyHTML = '<div class="post-body">';
  if (post.isRepost) {
    bodyHTML += `<div class="repost-label">♻ Reposted</div>`;
  }
  bodyHTML += `<div class="post-text">${renderHashtags(escapeHTML(post.content))}</div>`;
  if (post.imageURL) {
    bodyHTML += `<img class="post-image" src="${post.imageURL}" alt="post image" loading="lazy" />`;
  }
  bodyHTML += '</div>';

  // ── Footer ──
  const footerHTML = `
    <div class="post-footer">
      <button class="like-btn${hasLiked ? ' liked' : ''}" data-id="${post.id}">
        <span class="heart">${hasLiked ? '❤️' : '🤍'}</span>
        <span class="like-count">${post.likes}</span>
      </button>
      <button class="comment-toggle-btn" data-id="${post.id}">
        💬 <span>${post.comments.length}</span>
      </button>
    </div>
  `;

  // ── Comments ──
  const commentsHTML = buildCommentsHTML(post, commentsOpen);

  card.innerHTML = headerHTML + bodyHTML + footerHTML + commentsHTML;

  // ── Event Listeners ──
  card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id));
  card.querySelector('.comment-toggle-btn').addEventListener('click', () => toggleComments(post.id));
  if (isOwn) {
    card.querySelector('.delete-btn').addEventListener('click', () => deletePost(post.id));
    card.querySelector('.pin-btn').addEventListener('click', () => togglePin(post.id));
  }
  card.querySelector('.repost-btn').addEventListener('click', () => repost(post.id));

  // Comment submit
  const cs = card.querySelector('.comment-submit-btn');
  if (cs) cs.addEventListener('click', () => submitComment(post.id, card));

  const ci = card.querySelector('.comment-input');
  if (ci) ci.addEventListener('keydown', e => { if (e.key === 'Enter') submitComment(post.id, card); });

  // Hashtag clicks
  card.querySelectorAll('.hashtag').forEach(el => {
    el.addEventListener('click', () => filterByHashtag(el.dataset.tag));
  });

  return card;
}

function buildCommentsHTML(post, open = false) {
  let html = `<div class="comments-section${open ? ' open' : ''}">`;
  html += `
    <div class="comment-input-row">
      <input type="text" class="comment-input" placeholder="Add a comment…" />
      <button class="comment-submit-btn">Send</button>
    </div>
    <div class="comments-list">
  `;
  post.comments.forEach(c => {
    html += `
      <div class="comment-item">
        <div class="comment-avatar">${c.username[0].toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-username">${c.username}</span>
            <span class="comment-time">${timeAgo(c.timestamp)}</span>
          </div>
          <div class="comment-text">${escapeHTML(c.text)}</div>
        </div>
      </div>
    `;
  });
  html += '</div></div>';
  return html;
}

function toggleComments(postId) {
  const card = document.querySelector(`.post-card[data-id="${postId}"]`);
  if (!card) return;
  const section = card.querySelector('.comments-section');
  section.classList.toggle('open');
}

/* ══════════════════════════════════════════════════
   HTML ESCAPE
══════════════════════════════════════════════════ */

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ══════════════════════════════════════════════════
   POST CREATION
══════════════════════════════════════════════════ */

function createPost() {
  const textarea = document.getElementById('postContent');
  const content  = textarea.value.trim();

  if (!content && !imageDataURL) {
    showToast('Write something first!');
    return;
  }
  if (hasBadWords(content)) {
    showToast('⚠️ Content violates community guidelines. Please edit.');
    return;
  }

  const post = {
    id:        genId(),
    username:  CURRENT_USER,
    content,
    timestamp: Date.now(),
    imageURL:  imageDataURL || null,
    likes:     0,
    likedBy:   [],
    comments:  [],
    pinned:    false,
    isRepost:  false,
  };

  posts.unshift(post);
  syncPosts();

  textarea.value = '';
  clearImagePreview();
  loadedCount = Math.max(loadedCount, PAGE_SIZE);
  renderFeed();
  showToast('Post published!');
}

/* ══════════════════════════════════════════════════
   LIKE / UNLIKE
══════════════════════════════════════════════════ */

function toggleLike(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  post.likedBy = post.likedBy || [];
  const idx = post.likedBy.indexOf(CURRENT_USER);
  if (idx === -1) {
    post.likedBy.push(CURRENT_USER);
    post.likes++;
    if (post.username !== CURRENT_USER) {
      addNotification(`${CURRENT_USER} liked "${post.content.slice(0, 30)}…"`);
    }
  } else {
    post.likedBy.splice(idx, 1);
    post.likes = Math.max(0, post.likes - 1);
  }

  syncPosts();

  // Partial update — just re-render the card for performance
  const card = document.querySelector(`.post-card[data-id="${postId}"]`);
  if (card) {
    const commentsOpen = card.querySelector('.comments-section')?.classList.contains('open');
    const newCard = buildPostCard(post, commentsOpen);
    newCard.querySelector('.like-btn')?.classList.add('just-liked');
    card.replaceWith(newCard);
    newCard.querySelector('.like-btn')?.classList.add('just-liked');
    setTimeout(() => newCard.querySelector('.like-btn')?.classList.remove('just-liked'), 400);
  }
  updateAnalytics();
}

/* ══════════════════════════════════════════════════
   COMMENTS
══════════════════════════════════════════════════ */

function submitComment(postId, card) {
  const input = card.querySelector('.comment-input');
  const text  = input.value.trim();
  if (!text) return;

  if (hasBadWords(text)) {
    showToast('⚠️ Comment violates community guidelines. Please edit.');
    return;
  }

  const post = posts.find(p => p.id === postId);
  if (!post) return;

  const comment = {
    id:        genId(),
    username:  CURRENT_USER,
    text,
    timestamp: Date.now(),
  };
  post.comments.push(comment);
  syncPosts();

  if (post.username !== CURRENT_USER) {
    addNotification(`${CURRENT_USER} commented on "${post.content.slice(0, 30)}…"`);
  }

  // Re-render just this card with comments open
  const newCard = buildPostCard(post, true);
  card.replaceWith(newCard);
  updateAnalytics();
  showToast('Comment posted!');
}

/* ══════════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════════ */

function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  posts = posts.filter(p => p.id !== postId);
  syncPosts();
  renderFeed();
  showToast('Post deleted.');
}

/* ══════════════════════════════════════════════════
   PIN / UNPIN
══════════════════════════════════════════════════ */

function togglePin(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  post.pinned = !post.pinned;
  syncPosts();
  renderFeed();
  showToast(post.pinned ? '📌 Post pinned to top' : 'Post unpinned');
}

/* ══════════════════════════════════════════════════
   REPOST
══════════════════════════════════════════════════ */

function repost(postId) {
  const original = posts.find(p => p.id === postId);
  if (!original) return;

  const newPost = {
    id:        genId(),
    username:  CURRENT_USER,
    content:   original.content,
    timestamp: Date.now(),
    imageURL:  original.imageURL || null,
    likes:     0,
    likedBy:   [],
    comments:  [],
    pinned:    false,
    isRepost:  true,
    originalId: postId,
  };
  posts.unshift(newPost);
  syncPosts();
  renderFeed();
  showToast('♻ Reposted!');
}

/* ══════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════ */

function filterByHashtag(tag) {
  activeHashtag = tag;
  activeSearch  = '';
  document.getElementById('searchInput').value = tag;
  document.getElementById('searchClear').classList.remove('hidden');
  loadedCount = PAGE_SIZE;
  renderFeed();
}

function clearFilters() {
  activeSearch  = '';
  activeHashtag = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.add('hidden');
  loadedCount = PAGE_SIZE;
  renderFeed();
}

/* ══════════════════════════════════════════════════
   IMAGE UPLOAD + DRAG & DROP
══════════════════════════════════════════════════ */

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select an image file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    imageDataURL = e.target.result;
    const preview = document.getElementById('imagePreview');
    preview.src   = imageDataURL;
    document.getElementById('imagePreviewWrap').classList.remove('hidden');
    document.getElementById('dropZone').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function clearImagePreview() {
  imageDataURL = null;
  document.getElementById('imagePreview').src = '';
  document.getElementById('imagePreviewWrap').classList.add('hidden');
  document.getElementById('dropZone').classList.add('hidden');
}

/* ══════════════════════════════════════════════════
   INFINITE SCROLL
══════════════════════════════════════════════════ */

function setupInfiniteScroll() {
  const sentinel = document.getElementById('scrollSentinel');
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      const visible = getVisiblePosts();
      if (loadedCount < visible.length) {
        loadedCount += PAGE_SIZE;
        renderFeed();
      }
    }
  }, { threshold: 0.1 });
  observer.observe(sentinel);
}

/* ══════════════════════════════════════════════════
   SEED DEMO POSTS
══════════════════════════════════════════════════ */

function seedDemoPosts() {
  if (posts.length > 0) return;

  const demoPosts = [
    { username: 'Alex Kim',  content: 'Just shipped a new feature 🚀 #buildinpublic #webdev', likes: 12 },
    { username: 'Sarah O',   content: 'The #design process never gets old. Iterate, iterate, iterate.', likes: 8 },
    { username: 'Marco R',   content: 'Hot take: dark mode is not just aesthetic, it\'s a productivity boost #darkmode #ux', likes: 21 },
    { username: 'Priya D',   content: 'Working on something with #ai that might change how we think about #data pipelines.', likes: 5 },
    { username: 'Liam T',    content: 'Sunday morning, coffee, code. Life is good. ☕ #coding #vibes', likes: 17 },
    { username: CURRENT_USER, content: 'Hello world! Just joined Pulse 👋 #newhere', likes: 3 },
  ];

  const now = Date.now();
  demoPosts.forEach((d, i) => {
    posts.push({
      id:        genId(),
      username:  d.username,
      content:   d.content,
      timestamp: now - (demoPosts.length - i) * 20 * 60 * 1000,
      imageURL:  null,
      likes:     d.likes,
      likedBy:   [],
      comments:  [],
      pinned:    false,
      isRepost:  false,
    });
  });

  // Add a couple demo comments
  posts[0].comments.push({ id: genId(), username: 'Priya D', text: 'Congrats! What stack? 🔥', timestamp: now - 10 * 60 * 1000 });
  posts[2].comments.push({ id: genId(), username: 'Sarah O', text: 'AGREED 100%', timestamp: now - 5 * 60 * 1000 });

  syncPosts();
}

/* ══════════════════════════════════════════════════
   INIT & EVENT WIRING
══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // Apply saved theme
  applyTheme();

  // Seed demo data
  seedDemoPosts();

  // Init stories
  initStories();

  // Render sidebar suggestions
  renderSuggested();

  // Initial feed render
  renderFeed();

  // Notification badge
  updateNotifBadge();

  // ── Theme Toggle ──
  document.getElementById('themeToggle').addEventListener('click', () => {
    darkMode = !darkMode;
    saveToStorage('darkMode', darkMode);
    applyTheme();
  });

  // ── Feed Mode Toggle ──
  const feedToggle = document.getElementById('feedToggle');
  feedToggle.addEventListener('click', () => {
    feedMode = feedMode === 'chronological' ? 'algorithmic' : 'chronological';
    feedToggle.querySelector('.toggle-label').textContent = feedMode === 'algorithmic' ? 'Algorithmic' : 'Chronological';
    feedToggle.classList.toggle('active', feedMode === 'algorithmic');
    loadedCount = PAGE_SIZE;
    renderFeed();
    showToast(feedMode === 'algorithmic' ? '⚡ Algorithmic feed on' : '🕒 Chronological feed');
  });

  // ── Search ──
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    activeSearch  = searchInput.value.trim();
    activeHashtag = '';
    loadedCount   = PAGE_SIZE;
    document.getElementById('searchClear').classList.toggle('hidden', !activeSearch);
    renderFeed();
  });
  document.getElementById('searchClear').addEventListener('click', clearFilters);

  // ── Post Button ──
  document.getElementById('postBtn').addEventListener('click', createPost);
  document.getElementById('postContent').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createPost();
  });

  // ── Attach Image Button ──
  document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('dropZone').classList.toggle('hidden');
  });

  // ── File Input ──
  document.getElementById('imageInput').addEventListener('change', (e) => {
    handleImageFile(e.target.files[0]);
  });

  // ── Remove Image ──
  document.getElementById('removeImage').addEventListener('click', clearImagePreview);

  // ── Drag & Drop ──
  const dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleImageFile(e.dataTransfer.files[0]);
  });

  // Global drag-over on create card
  const createCard = document.getElementById('createPostCard');
  createCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.getElementById('dropZone').classList.remove('hidden');
    dropZone.classList.add('drag-over');
  });

  // ── Notifications ──
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('hidden');
    if (!notifDropdown.classList.contains('hidden')) renderNotifications();
  });
  document.addEventListener('click', () => notifDropdown.classList.add('hidden'));
  notifDropdown.addEventListener('click', e => e.stopPropagation());

  document.getElementById('clearNotifs').addEventListener('click', () => {
    notifications = [];
    syncNotifications();
    updateNotifBadge();
    renderNotifications();
  });

  // ── Story Close ──
  document.getElementById('storyClose').addEventListener('click', closeStory);
  document.getElementById('storyModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('storyModal')) closeStory();
  });

  // ── Infinite Scroll ──
  setupInfiniteScroll();

  // ── Auto-refresh time labels every minute ──
  setInterval(() => renderFeed(), 60000);
});
