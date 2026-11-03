// Generates placeholder book cover SVGs into public/covers (front + back per seeded book).
// Usage: node scripts/generate-covers.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'covers');
mkdirSync(outDir, { recursive: true });

// slug must match slugify(title) used by backend/prisma/seed.ts
const BOOKS = [
  {
    title: 'The Art of Focus',
    author: 'Arjun Patel',
    bg: '#f4f1ea',
    fg: '#1f2937',
    accent: '#dc2626',
    motif: 'target',
    blurb: 'Practical guide to mastering focus and thriving in the modern everyday way.',
  },
  {
    title: 'The Art of Learning',
    author: 'Raj Patel',
    bg: '#c62828',
    fg: '#fff7ed',
    accent: '#fbbf24',
    motif: 'bulb',
    blurb: 'Master the mindset and methods for lifelong learning.',
  },
  {
    title: 'The Path to Success',
    author: 'James Wright',
    bg: '#0e7490',
    fg: '#ecfeff',
    accent: '#facc15',
    motif: 'path',
    blurb: 'A practical guide to achieving goals with clarity and confidence.',
  },
  {
    title: 'The Midnight Hour',
    author: 'James Adams',
    bg: '#0f172a',
    fg: '#e2e8f0',
    accent: '#f59e0b',
    motif: 'moon',
    blurb: 'Haunting tale of a mans journey and the shadows of a quiet town.',
  },
  {
    title: 'Beneath the Stars',
    author: 'Jessica Martin',
    bg: '#4c1d95',
    fg: '#faf5ff',
    accent: '#f9a8d4',
    motif: 'stars',
    blurb: 'A heartwarming story of love under a night sky.',
  },
  {
    title: 'The Final Frontier',
    author: 'Laura Mitchell',
    bg: '#172554',
    fg: '#eff6ff',
    accent: '#60a5fa',
    motif: 'rocket',
    blurb: 'A mission to space and the courage to change humanity forever.',
  },
  {
    title: 'Joy of Minimalism',
    author: 'Daniel Reed',
    bg: '#facc15',
    fg: '#1c1917',
    accent: '#1c1917',
    motif: 'arch',
    blurb: 'Declutter your life to uncover peace, clarity, and joy.',
  },
  {
    title: 'The Vanishing House',
    author: 'Clara Nelson',
    bg: '#14532d',
    fg: '#f0fdf4',
    accent: '#bef264',
    motif: 'house',
    blurb: 'A chilling mystery within a house that disappears.',
  },
  {
    title: 'The Lost Kitten',
    author: 'Emily Rose',
    bg: '#f97316',
    fg: '#431407',
    accent: '#fff7ed',
    motif: 'cat',
    blurb: 'A heartwarming tale of courage, friendship, and home adventure.',
  },
];

const W = 300;
const H = 450;
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function motif(kind, c) {
  const a = c.accent;
  const f = c.fg;
  switch (kind) {
    case 'target':
      return `<circle cx="150" cy="270" r="62" fill="none" stroke="${a}" stroke-width="12"/><circle cx="150" cy="270" r="38" fill="none" stroke="${a}" stroke-width="12"/><circle cx="150" cy="270" r="14" fill="${a}"/>`;
    case 'bulb':
      return `<circle cx="150" cy="255" r="46" fill="${a}"/><rect x="132" y="296" width="36" height="22" rx="4" fill="${f}"/><rect x="138" y="322" width="24" height="8" rx="3" fill="${f}"/>`;
    case 'path':
      return `<polygon points="60,360 240,360 170,215 130,215" fill="${f}" opacity="0.85"/><polygon points="148,360 152,360 156,215 144,215" fill="${a}"/>`;
    case 'moon':
      return `<circle cx="150" cy="265" r="58" fill="${a}"/><circle cx="174" cy="250" r="52" fill="${c.bg}"/>`;
    case 'stars':
      return [
        [70, 240, 5],
        [220, 230, 4],
        [150, 280, 7],
        [95, 320, 4],
        [215, 320, 5],
        [250, 270, 3],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}"/>`)
        .join('');
    case 'rocket':
      return `<ellipse cx="150" cy="270" rx="22" ry="62" fill="${f}"/><polygon points="128,300 108,336 140,320" fill="${a}"/><polygon points="172,300 192,336 160,320" fill="${a}"/><circle cx="150" cy="255" r="9" fill="${a}"/>`;
    case 'arch':
      return `<path d="M100 350 V285 a50 50 0 0 1 100 0 V350 H178 V285 a28 28 0 0 0 -56 0 V350 Z" fill="${a}"/>`;
    case 'house':
      return `<polygon points="80,300 150,240 220,300" fill="${a}"/><rect x="100" y="300" width="100" height="60" fill="${f}" opacity="0.35"/><rect x="138" y="322" width="24" height="38" fill="${c.bg}"/>`;
    case 'cat':
      return `<polygon points="105,255 115,215 140,240" fill="${c.fg}"/><polygon points="195,255 185,215 160,240" fill="${c.fg}"/><circle cx="150" cy="285" r="52" fill="${c.fg}"/><circle cx="132" cy="278" r="7" fill="${a}"/><circle cx="168" cy="278" r="7" fill="${a}"/><polygon points="145,295 155,295 150,303" fill="${a}"/>`;
    default:
      return '';
  }
}

function front(b) {
  const titleLines = wrap(b.title.toUpperCase(), 13);
  const fs = titleLines.length > 3 ? 24 : 30;
  const titleSvg = titleLines
    .map(
      (l, i) =>
        `<text x="150" y="${70 + i * (fs + 6)}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${fs}" fill="${b.fg}">${esc(l)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.title)} cover">
<rect width="${W}" height="${H}" fill="${b.bg}"/>
<rect x="0" y="0" width="12" height="${H}" fill="#000" opacity="0.18"/>
${titleSvg}
${motif(b.motif, b)}
<text x="150" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="${b.fg}">${esc(b.author.toUpperCase())}</text>
</svg>
`;
}

function back(b) {
  const lines = wrap(b.blurb, 28);
  const text = lines
    .map(
      (l, i) =>
        `<text x="40" y="${120 + i * 22}" font-family="Georgia, serif" font-size="15" fill="${b.fg}">${esc(l)}</text>`,
    )
    .join('');
  const bars = Array.from(
    { length: 28 },
    (_, i) =>
      `<rect x="${196 + i * 3}" y="388" width="${i % 3 === 0 ? 2 : 1}" height="34" fill="#111"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.title)} back cover">
<rect width="${W}" height="${H}" fill="${b.bg}"/>
<rect x="288" y="0" width="12" height="${H}" fill="#000" opacity="0.18"/>
<text x="40" y="70" font-family="Georgia, serif" font-weight="700" font-size="18" fill="${b.accent}">${esc(b.title)}</text>
${text}
<rect x="190" y="382" width="100" height="46" fill="#fff"/>${bars}
<text x="40" y="420" font-family="Arial, sans-serif" font-size="12" fill="${b.fg}">BookWorm Press</text>
</svg>
`;
}

for (const b of BOOKS) {
  const slug = slugify(b.title);
  writeFileSync(join(outDir, `${slug}-front.svg`), front(b));
  writeFileSync(join(outDir, `${slug}-back.svg`), back(b));
}
console.log(`Wrote ${BOOKS.length * 2} covers to ${outDir}`);
