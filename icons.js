// Einheitlicher Symbolsatz: ersetzt Emojis und Sonderzeichen in der Oberfläche durch Strich-Symbole (SVG).
// Der ursprüngliche Text bleibt unsichtbar im Element, damit Kopieren, Vorlesen und Suchen unverändert funktionieren.
(() => {
  const S = (inner, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra} aria-hidden="true" focusable="false">${inner}</svg>`;
  const ICONS = {
    briefcase: S('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"/><path d="M3 12.5h18"/>'),
    wallet: S('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="3.5" y="8" width="17" height="11.5" rx="2.5"/><path d="M16 13.8h4.5"/>'),
    train: S('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="M9 14.2h.01M15 14.2h.01"/><path d="m8 20.5 2-3.5M16 20.5 14 17"/>'),
    shield: S('<path d="M12 3 5 6v5.5c0 4.5 2.9 7.8 7 9.5 4.1-1.7 7-5 7-9.5V6l-7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
    health: S('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M7.5 12H10l1.2-2 1.6 4 1.2-2h2"/>'),
    home: S('<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>'),
    card: S('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>'),
    users: S('<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 13.7c2.7 0 4.5 1.7 4.5 4.3"/>'),
    gift: S('<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3.5H3zM12 9v11"/><path d="M12 9c-1.5-3.5-5-3.5-5-1.2C7 9 9 9 12 9Zm0 0c1.5-3.5 5-3.5 5-1.2C17 9 15 9 12 9Z"/>'),
    columns: S('<path d="M3 9.5 12 4l9 5.5z"/><path d="M5.5 12v6M10 12v6M14 12v6M18.5 12v6"/><path d="M3.5 20.5h17"/>'),
    folder: S('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
    folderOpen: S('<path d="M3.5 17.5v-10a2 2 0 0 1 2-2h3.2l2 2h6.8a2 2 0 0 1 2 2v1"/><path d="M5 19.5h12.3a2 2 0 0 0 1.9-1.4l1.6-5.4a1 1 0 0 0-.9-1.2H7.6a2 2 0 0 0-1.9 1.4Z"/>'),
    folders: S('<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M6.5 8V6a1.5 1.5 0 0 1 1.5-1.5h3L12.5 6H17a1.5 1.5 0 0 1 1.5 1.5V8"/>'),
    user: S('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>'),
    cloud: S('<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a4 4 0 0 1-.5 8Z"/>'),
    pin: S('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>'),
    save: S('<path d="M5 4h11l3 3v13H5Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    camera: S('<path d="M4 8.5a2 2 0 0 1 2-2h1.6L9 4.5h6l1.4 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.6"/>'),
    image: S('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 4.5-4.2 3.5 3.2 3-2.6L20 16"/>'),
    upload: S('<path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>'),
    pencil: S('<path d="M4 20v-3.6L16.2 4.2a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L7.6 20Z"/><path d="m14.5 6 3.5 3.5"/>'),
    party: S('<path d="m5 20 3.2-9.5 6.3 6.3Z"/><path d="M14 5v2M19 9h2M17.2 12l1.6-1.6M10.5 6l.6 1.6"/>'),
    globe: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.3-3.6-8.5S9.4 5.9 12 3.5Z"/>'),
    receipt: S('<path d="M6 3.5h12v17l-2.2-1.5-1.9 1.5-1.9-1.5-1.9 1.5L8 19l-2 1.5Z"/><path d="M9 8.5h6M9 12h6"/>'),
    list: S('<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>'),
    printer: S('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7Z"/>'),
    copy: S('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
    lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    unlock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 7.4-2.1"/>'),
    sliders: S('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
    check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
    x: S('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    left: S('<path d="m15 5-7 7 7 7"/>', 'stroke-width="2.4"'),
    right: S('<path d="m9 5 7 7-7 7"/>', 'stroke-width="2.4"'),
    more: S('<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>', 'fill="currentColor" stroke="none"'),
    circle: S('<circle cx="12" cy="12" r="7.5"/>'),
    rotate: S('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>'),
    up: S('<path d="M12 19V5m0 0-5 5m5-5 5 5"/>'),
    down: S('<path d="M12 5v14m0 0-5-5m5 5 5-5"/>'),
    download: S('<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 19.5h14"/>'),
    import: S('<path d="M12 20V9m0 0-4 4m4-4 4 4"/><path d="M5 4.5h14"/>'),
  };
  // Zeichen → Symbol. Reihenfolge egal, längere Folgen werden zuerst gefunden.
  const MAP = {
    '💼': 'briefcase', '🏦': 'wallet', '🚆': 'train', '🛡': 'shield', '🏥': 'health', '🏠': 'home', '💳': 'card',
    '👨‍👩‍👧': 'users', '🎁': 'gift', '🏛': 'columns', '📁': 'folder', '📂': 'folderOpen', '🗂': 'folders', '👤': 'user',
    '☁': 'cloud', '📍': 'pin', '💾': 'save', '📷': 'camera', '🖼': 'image', '📤': 'upload', '⇪': 'upload',
    '✏': 'pencil', '✎': 'pencil', '🎉': 'party', '🌐': 'globe', '🧾': 'receipt', '📝': 'list', '🖨': 'printer',
    '📋': 'copy', '🔒': 'lock', '🔓': 'unlock', '⚙': 'sliders', '✓': 'check', '✕': 'x', '＋': 'plus',
    '‹': 'left', '›': 'right', '⋯': 'more', '○': 'circle', '⟳': 'rotate', '↑': 'up', '↓': 'down', '⤓': 'download', '⤒': 'import',
  };
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RE = new RegExp(`(${keys.join('|')})[\\uFE0E\\uFE0F]?`, 'g');
  // Nicht anfassen: Texteingaben, Auswahllisten und Texte, die Nutzer selbst schreiben (Belegnamen, Ordnernamen)
  const SKIP = 'script, style, textarea, option, input, select, title, svg, .ic, #title, .doctitle, .docsub, .card-name, .no-icons';

  function make(ch, glyph) {
    const span = document.createElement('span');
    span.className = 'ic ic-' + MAP[ch];
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = ICONS[MAP[ch]] + '<i class="e"></i>';
    span.lastChild.textContent = glyph;
    return span;
  }
  function convert(node) {
    const text = node.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(make(m[1], m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentElement && !root.parentElement.closest(SKIP)) convert(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) { const n = w.currentNode; if (n.parentElement && !n.parentElement.closest(SKIP)) nodes.push(n); }
    nodes.forEach(convert);
  }
  const start = () => {
    scan(document.body);
    new MutationObserver((list) => {
      for (const r of list) {
        if (r.type === 'characterData') scan(r.target);
        else r.addedNodes.forEach(scan);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
