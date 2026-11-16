#!/usr/bin/env node
/* LakeQuest — assemblage en un seul fichier.  Usage : node tools/build.js
   Le site fonctionne tel quel depuis index.html (aucune compilation nécessaire).
   Ce script sert seulement à produire, dans dist/ :
     - lakequest.html           une page autonome, à ouvrir ou à héberger n'importe où ;
     - lakequest-artifact.html  le même contenu sans <html>/<head>/<body>, pour une publication en artifact Claude. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="((?!https?:)[^"]+)">/g)].map((m) => m[1]);
if (!scripts.length || !styles.length) { console.error('index.html : scripts ou feuille de style introuvables.'); process.exit(1); }

const css = styles.map(read).join('\n');
const js = scripts.map((f) => '/* ── ' + f + ' ── */\n' + read(f)).join('\n;\n');
if (/<\/script/i.test(js)) { console.error('Un fichier JavaScript contient « </script » : il casserait la page assemblée.'); process.exit(1); }

const pick = (re) => (html.match(re) || [''])[0];
const title = pick(/<title>[^<]*<\/title>/);
const desc = pick(/<meta name="description"[^>]*>/);
const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^>]*>/g)].map((m) => m[0]).join('\n');
const icon = pick(/<link rel="icon"[^>]*>/);
const theme = pick(/<meta name="theme-color"[^>]*>/);
const app = '<div id="app"><noscript>LakeQuest a besoin de JavaScript pour fonctionner.</noscript></div>';

const standalone = [
  '<!doctype html>', '<html lang="fr">', '<head>', '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  title, desc, theme, icon, fonts, '<style>', css, '</style>', '</head>', '<body>', app, '<script>', js, '</script>', '</body>', '</html>', '',
].join('\n');

const artifact = [
  '<title>LakeQuest DEA-C01</title>', '<meta name="claude:viewport-fit-sides" content="cover">', fonts, '<style>', css, '</style>', app, '<script>', js, '</script>', '',
].join('\n');

const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'lakequest.html'), standalone);
fs.writeFileSync(path.join(out, 'lakequest-artifact.html'), artifact);
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024) + ' Ko';
console.log('dist/lakequest.html           ' + kb(standalone));
console.log('dist/lakequest-artifact.html  ' + kb(artifact));
