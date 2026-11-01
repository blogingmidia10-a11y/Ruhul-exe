/* ==========================================================
   Ruhul Exe – site logic (no build step, no paid APIs)
   - Latest videos: public YouTube RSS feed
   - Live status + subscriber count: optional free API key,
     otherwise a best-effort check. If a value cannot be
     confirmed, it is hidden or marked "unknown" – never faked.
   ========================================================== */
(() => {
  'use strict';
  const C = window.SITE_CONFIG;
  const $ = (s) => document.querySelector(s);

  /* ---------- helpers ---------- */
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  }
  const cacheGet = (k, mins) => {
    try {
      const r = JSON.parse(localStorage.getItem(k));
      if (r && Date.now() - r.t < mins * 60000) return r.v;
    } catch (e) { /* ignore */ }
    return null;
  };
  const cacheSet = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* ignore */ }
  };
  async function fetchWithTimeout(url, ms = 10000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    } finally { clearTimeout(t); }
  }
  const getJSON = async (u) => (await fetchWithTimeout(u)).json();
  const getText = async (u) => (await fetchWithTimeout(u)).text();

  // Free public CORS proxies (browsers cannot read YouTube pages directly)
  const proxies = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?' + encodeURIComponent(u)
  ];
  async function proxyText(url) {
    for (const p of proxies) {
      try {
        const t = await getText(p(url));
        if (t && t.length > 500) return t;
      } catch (e) { /* try next */ }
    }
    throw new Error('proxy failed');
  }

  const parseDate = (d) => new Date(/T/.test(d) ? d : d.replace(' ', 'T') + 'Z');
  const fmtDate = (d) => parseDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const watchUrl = (id) => 'https://www.youtube.com/watch?v=' + id;
  const embedUrl = (id) => 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&autoplay=1&playsinline=1';
  const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n)).replace('.0', '');

  /* ---------- navigation ---------- */
  const burger = $('#burger');
  const menu = $('#menu');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  const links = [...document.querySelectorAll('[data-link]')];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => io.observe(s));

  /* ---------- latest videos ---------- */
  const grid = $('#videoGrid');
  const frame = $('#playerFrame');
  const playerTitle = $('#playerTitle');
  const errBox = $('#videoError');
  let videos = [];

  function play(id, scroll) {
    const v = videos.find((x) => x.id === id);
    frame.replaceChildren(h('iframe', {
      src: embedUrl(id),
      title: v ? v.title : 'YouTube video player',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin'
    }));
    playerTitle.textContent = v ? v.title : '';
    if (scroll) $('#player').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showPoster(v) {
    const poster = h('button', {
      class: 'poster', type: 'button', 'aria-label': 'Play ' + v.title,
      style: "background-image:url('https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg')",
      onclick: () => play(v.id, false)
    }, h('span', { class: 'play-btn', 'aria-hidden': 'true' }));
    frame.replaceChildren(poster);
    playerTitle.textContent = v.title;
  }

  function card(v) {
    return h('article', { class: 'vcard' },
      h('button', { class: 'vthumb', type: 'button', 'aria-label': 'Play ' + v.title, onclick: () => play(v.id, true) },
        h('img', { src: 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg', alt: '', loading: 'lazy', width: '320', height: '180' }),
        h('span', { class: 'play-badge', 'aria-hidden': 'true' })),
      h('div', { class: 'vbody' },
        h('h3', { class: 'vtitle', text: v.title }),
        h('time', { class: 'vdate', datetime: v.date, text: fmtDate(v.date) }),
        h('div', { class: 'vactions' },
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => play(v.id, true) }, 'Watch Now'),
          h('a', { class: 'btn btn-ghost btn-sm', href: watchUrl(v.id), target: '_blank', rel: 'noopener' }, 'YouTube'))));
  }

  async function fetchVideos() {
    const cached = cacheGet('rx_videos', 15);
    if (cached) return cached;
    const feed = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + C.channelId;
    let items;
    try {
      const d = await getJSON('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed));
      if (d.status !== 'ok') throw new Error('rss2json');
      items = d.items.map((i) => ({
        id: new URL(i.link).searchParams.get('v') || String(i.guid).replace('yt:video:', ''),
        title: i.title,
        date: i.pubDate
      }));
    } catch (e) {
      const xml = await proxyText(feed);
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      items = [...doc.querySelectorAll('entry')].map((en) => ({
        id: en.getElementsByTagName('yt:videoId')[0].textContent,
        title: en.querySelector('title').textContent,
        date: en.querySelector('published').textContent
      }));
    }
    if (!items.length) throw new Error('no videos');
    cacheSet('rx_videos', items);
    return items;
  }

  async function loadVideos() {
    errBox.hidden = true;
    grid.replaceChildren();
    try {
      videos = await fetchVideos();
      showPoster(videos[0]);
      grid.replaceChildren(...videos.map(card));
      $('#lastUpload').textContent = fmtDate(videos[0].date);
      $('#lastStat').hidden = false;
    } catch (e) {
      frame.replaceChildren();
      playerTitle.textContent = '';
      errBox.hidden = false;
    }
    checkLive();
  }
  $('#videoRetry').addEventListener('click', () => { localStorage.removeItem('rx_videos'); loadVideos(); });

  /* ---------- subscriber count (only shown when confirmed) ---------- */
  async function loadSubs() {
    let txt = cacheGet('rx_subs', 60);
    if (!txt && C.apiKey) {
      try {
        const d = await getJSON('https://www.googleapis.com/youtube/v3/channels?part=statistics&id=' + C.channelId + '&key=' + encodeURIComponent(C.apiKey));
        const s = d.items && d.items[0] && d.items[0].statistics;
        if (s && !s.hiddenSubscriberCount) txt = compact(Number(s.subscriberCount));
      } catch (e) { /* fall through */ }
    }
    if (!txt) {
      try {
        const html = await proxyText(C.channelUrl);
        const m = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+?) subscribers?"/)
          || html.match(/"subscriberCountText":\{"simpleText":"([^"]+?) subscribers?"/)
          || html.match(/"content":"([\d.,]+[KMB]?) subscribers"/);
        if (m) txt = m[1];
      } catch (e) { /* hidden below */ }
    }
    if (txt) {
      cacheSet('rx_subs', txt);
      $('#subCount').textContent = txt;
      $('#subStat').hidden = false;
    }
  }

  /* ---------- live status ---------- */
  const liveCard = $('#liveCard');
  const liveBody = $('#liveBody');
  const badgeText = $('#liveBadgeText');

  function setLive(state, id) {
    liveCard.dataset.state = state;
    if (state === 'live') {
      badgeText.textContent = 'LIVE NOW';
      liveBody.replaceChildren(h('div', { class: 'live-frame' }, h('iframe', {
        src: embedUrl(id), title: 'Ruhul Exe live stream',
        allow: 'autoplay; encrypted-media; picture-in-picture; web-share', allowfullscreen: ''
      })));
    } else if (state === 'offline') {
      badgeText.textContent = 'OFFLINE';
      liveBody.replaceChildren(h('div', { class: 'live-msg-box' },
        h('div', { class: 'off-ico', 'aria-hidden': 'true' }, '⏻'),
        h('h3', { text: 'Currently offline' }),
        h('p', { text: 'Ruhul Exe is not streaming right now. Subscribe and tap the bell to get a notification when the next live starts.' }),
        h('div', { class: 'cta-row' },
          h('a', { class: 'btn btn-primary', href: C.subscribeUrl, target: '_blank', rel: 'noopener' }, 'Subscribe Now'),
          h('a', { class: 'btn btn-ghost', href: '#videos' }, 'Watch latest videos'))));
    } else {
      badgeText.textContent = 'STATUS UNKNOWN';
      liveBody.replaceChildren(h('div', { class: 'live-msg-box' },
        h('div', { class: 'off-ico', 'aria-hidden': 'true' }, '?'),
        h('h3', { text: 'Could not check live status' }),
        h('p', { text: 'The check did not go through. You can try again or look at the channel directly.' }),
        h('div', { class: 'cta-row' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => checkLive(true) }, 'Check again'),
          h('a', { class: 'btn btn-ghost', href: C.channelUrl + '/live', target: '_blank', rel: 'noopener' }, 'Open live page'))));
    }
  }

  async function detectLive() {
    // 1) Official free API (needs the optional key): inspect recent uploads for an active broadcast.
    if (C.apiKey && videos.length) {
      try {
        const ids = videos.map((v) => v.id).join(',');
        const d = await getJSON('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + ids + '&key=' + encodeURIComponent(C.apiKey));
        const live = d.items.find((v) => v.snippet.liveBroadcastContent === 'live');
        return live ? { state: 'live', id: live.id } : { state: 'offline' };
      } catch (e) { /* fall through */ }
    }
    // 2) Best-effort: read the channel's /live page through a free proxy.
    try {
      const html = await proxyText('https://www.youtube.com/channel/' + C.channelId + '/live');
      const isLive = /"isLiveNow":true/.test(html);
      const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
      if (isLive && m) return { state: 'live', id: m[1] };
      if (html.includes('ytInitialData') || html.includes('ytInitialPlayerResponse')) return { state: 'offline' };
    } catch (e) { /* unknown */ }
    return { state: 'unknown' };
  }

  let liveBusy = false;
  async function checkLive(force) {
    if (liveBusy) return;
    liveBusy = true;
    if (force) {
      liveCard.dataset.state = 'checking';
      badgeText.textContent = 'Checking…';
      liveBody.replaceChildren(h('p', { class: 'live-msg' }, 'Checking whether Ruhul Exe is live…'));
    }
    const res = await detectLive();
    const prev = liveCard.dataset.state;
    // do not restart a running live player on every refresh
    if (!(res.state === 'live' && prev === 'live')) setLive(res.state, res.id);
    liveBusy = false;
  }
  setInterval(() => checkLive(false), 120000);

  /* ---------- community (manual posts only; YouTube has no free feed) ---------- */
  const posts = $('#posts');
  (C.communityPosts || []).forEach((p) => {
    posts.append(h('article', { class: 'post' },
      p.date ? h('time', { datetime: p.date, text: fmtDate(p.date) }) : null,
      h('p', { text: p.text }),
      p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener' }, 'View post on YouTube') : null));
  });

  /* ---------- social links (only the ones you filled in) ---------- */
  const socialDefs = {
    instagram: ['◎', 'Instagram'], facebook: ['f', 'Facebook'], x: ['𝕏', 'X (Twitter)'],
    telegram: ['➤', 'Telegram'], whatsapp: ['✆', 'WhatsApp'], discord: ['#', 'Discord']
  };
  const list = $('#socialList');
  Object.entries(C.socials || {}).forEach(([k, url]) => {
    if (!url || !socialDefs[k]) return;
    list.append(h('li', {}, h('a', { href: url, target: '_blank', rel: 'noopener' },
      h('span', { class: 's-ico', 'aria-hidden': 'true' }, socialDefs[k][0]), socialDefs[k][1],
      h('small', { text: url.replace(/^https?:\/\//, '') }))));
  });

  /* ---------- contact form (opens the visitor's email app) ---------- */
  $('#contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $('#formError');
    const name = f.name.value.trim();
    const subject = f.subject.value.trim();
    const msg = f.message.value.trim();
    if (!name || !subject || !msg) {
      err.textContent = 'Please fill in your name, subject and message.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const body = msg + '\n\n– ' + name;
    window.location.href = 'mailto:' + C.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });

  /* ---------- share ---------- */
  $('#shareBtn').addEventListener('click', async () => {
    const note = $('#shareNote');
    const data = { title: 'Ruhul Exe – Official Website', text: 'Watch Ruhul Exe on YouTube', url: location.href };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(location.href);
      note.textContent = 'Link copied.';
    } catch (e) {
      if (e && e.name !== 'AbortError') note.textContent = 'Copy this address from your browser: ' + location.href;
    }
  });

  $('#year').textContent = new Date().getFullYear();

  /* ---------- start ---------- */
  loadVideos();
  loadSubs();
})();
