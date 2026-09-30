'use strict';

// Configuración: API_KEY (YouTube Data API v3, opcional) y HERO_VIDEO (nombre del .mp4 junto a index.html)
const CHANNEL_ID = 'UC6DQ6Dd5oGRD2zXb11IyuMQ';
const API_KEY = '__YOUTUBE_API_KEY__'; // GitHub Actions sustituye este marcador al desplegar; no pegues la clave aquí a mano
const HERO_VIDEO = 'bm.mp4';
const UPLOADS_NO_SHORTS = 'UULF' + CHANNEL_ID.slice(2);
const HOME_LIMIT = 8;
const VIDEOS_LIMIT = 20;

// Datos: catálogo de merch, en static/merch.json — edítalo ahí, sin tocar este script
const MERCH_FILE = 'static/merch.json';
const MERCH_HOME_LIMIT = 4;

// Utilidad: crea un elemento con clase y texto opcionales
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

// Datos: pide los últimos vídeos con la API oficial de YouTube y descarta Shorts, privados y borrados
const getVideos = async () => {
  const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails'
    + `&maxResults=${VIDEOS_LIMIT}&playlistId=${UPLOADS_NO_SHORTS}&key=${API_KEY}`;
  const data = await (await fetch(url)).json();
  const videos = (data.items || []).map(({ snippet }) => ({
    id: snippet.resourceId.videoId, title: snippet.title, date: snippet.publishedAt,
  }));
  return videos.filter((v) => v.id && !['Private video', 'Deleted video'].includes(v.title));
};


// Vista: crea la miniatura 16:9 de un vídeo, con respaldo si no existe la versión HD
const createThumbImage = (id, lazy = true) => {
  const img = el('img');
  img.loading = lazy ? 'lazy' : 'eager';
  img.alt = '';
  const useFallback = () => {
    img.onerror = img.onload = null;
    img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  };
  img.onerror = useFallback;
  img.onload = () => { if (img.naturalWidth <= 120) useFallback(); };
  img.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  return img;
};

// Vista: crea una tarjeta con miniatura 16:9 que enlaza al vídeo en YouTube
const createCard = ({ id, title, date }) => {
  const link = el('a', 'card');
  link.href = `https://www.youtube.com/watch?v=${id}`;
  link.target = '_blank';
  link.rel = 'noopener';

  const thumb = el('div', 'thumb thumb--img');
  thumb.append(createThumbImage(id));

  const body = el('div', 'card__body');
  body.append(el('h3', '', title));
  const published = new Date(date);
  if (!isNaN(published)) {
    body.append(el('small', '', published.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })));
  }
  link.append(thumb, body);
  return link;
};

// Vista: muestra la miniatura del último vídeo en el hero, enlazada a YouTube
const renderHero = ({ id, title }) => {
  const link = document.getElementById('hero-video');
  link.setAttribute('aria-label', `Ver en YouTube: ${title}`);
  link.replaceChildren(createThumbImage(id, false));
};

// Vista: sustituye el contenido de una rejilla por las tarjetas de los vídeos
const renderList = (box, videos) => box.replaceChildren(...videos.map(createCard));

// Vista: crea una tarjeta de producto de merch (foto en static/, nombre y precio)
const createMerchCard = ({ image, name, price, url }) => {
  const link = el('a', 'card');
  link.href = url;
  const thumb = el('div', 'thumb');
  const img = el('img');
  img.src = image;
  img.alt = name;
  img.loading = 'lazy';
  thumb.append(img);
  const body = el('div', 'card__body');
  body.append(el('h3', '', name), el('small', 'price', price));
  link.append(thumb, body);
  return link;
};
const renderMerch = (box, items) => box.replaceChildren(...items.map(createMerchCard));

// Fondo del hero: vídeo local en bucle y mudo (reinicia unos ms antes del final para evitar el parón), salvo reducir movimiento
if (HERO_VIDEO && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const bg = el('video', 'hero__bgvideo');
  bg.src = HERO_VIDEO;
  bg.preload = 'auto';
  bg.fetchPriority = 'high';
  bg.muted = bg.loop = bg.autoplay = bg.playsInline = true;
  bg.setAttribute('muted', '');
  bg.addEventListener('error', () => bg.remove());
  const restartNearEnd = () => {
    if (bg.duration && bg.currentTime >= bg.duration - 0.12) bg.currentTime = 0;
    requestAnimationFrame(restartNearEnd);
  };
  bg.addEventListener('playing', () => requestAnimationFrame(restartNearEnd), { once: true });
  document.getElementById('hero-bg').append(bg);
  bg.play().catch(() => {});
}

// Navegación: muestra inicio, vídeos, merch o About según la ruta de la URL (rutas limpias, sin #)
const home = document.getElementById('top');
const PAGES = {
  '/videos': { el: document.getElementById('vp'), title: 'Vídeos' },
  '/merch': { el: document.getElementById('mp'), title: 'Merch' },
  '/about': { el: document.getElementById('ap'), title: 'About' },
};
const route = () => {
  const page = PAGES[location.pathname];
  home.hidden = !!page;
  Object.values(PAGES).forEach((p) => { p.el.hidden = p !== page; });
  document.title = page ? `${page.title} · Entre Cartones` : 'Entre Cartones';
  const target = !page && document.getElementById(location.hash.slice(1));
  if (target) target.scrollIntoView(); else scrollTo(0, 0);
};

// Navegación: intercepta los clics en enlaces internos (/, /videos, /merch, /about)
// para cambiar de vista sin recargar la página, usando el historial del navegador
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || link.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !(url.pathname === '/' || url.pathname in PAGES)) return;
  event.preventDefault();
  if (url.pathname !== location.pathname) history.pushState(null, '', url.pathname + url.hash);
  route();
});
window.addEventListener('popstate', route);

// About: si falta la foto de perfil en static/, se queda el avatar con la inicial
document.querySelectorAll('.lt__photo img').forEach((img) => {
  const hide = () => img.remove();
  if (img.complete && img.naturalWidth === 0) hide(); else img.addEventListener('error', hide);
});

// Datos: lee el catálogo de merch desde static/merch.json (si falla, las tarjetas se quedan vacías)
const getMerch = () => fetch(MERCH_FILE).then((res) => res.json()).catch(() => []);

// Arranque: pinta el merch, activa la navegación y carga los vídeos
getMerch().then((items) => {
  renderMerch(document.getElementById('merch-home'), items.slice(0, MERCH_HOME_LIMIT));
  renderMerch(document.getElementById('merch-all'), items);
}).catch(() => {});
const homeGrid = document.getElementById('vids');
const videosGrid = document.getElementById('vids2');
videosGrid.innerHTML = homeGrid.innerHTML;
route();
getVideos().then((videos) => {
  if (!videos.length) return;
  renderHero(videos[0]);
  renderList(homeGrid, videos.slice(0, HOME_LIMIT));
  renderList(videosGrid, videos.slice(0, VIDEOS_LIMIT));
}).catch(() => {});