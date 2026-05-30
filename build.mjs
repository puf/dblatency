import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

mkdirSync('dist', { recursive: true });

const html = readFileSync('index.html', 'utf8');
writeFileSync(
  'dist/index.html',
  html + '\n<script src="index.js"></script>'
);

copyFileSync('style.css', 'dist/style.css');