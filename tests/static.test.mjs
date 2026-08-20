// Static contract tests: HTML ids, CSS variables, palette legibility, importmap.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, assert, equal } from './lib/harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const htmlClasses = new Set(
    [...html.matchAll(/\sclass="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean)
);

// ── Colour helpers ─────────────────────────────────────────────────────────
function srgbToLinear(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

const cssVars = Object.fromEntries(
    [...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(m => [m[1], m[2].trim()])
);

describe('index.html / app.js DOM contract', () => {
    it('every getElementById target exists in the markup', () => {
        const missing = [...js.matchAll(/getElementById\('([^']+)'\)/g)]
            .map(m => m[1])
            .filter(id => !htmlIds.has(id));
        equal(missing.join(', '), '', 'ids referenced by app.js but absent from index.html');
    });

    it('every querySelectorAll class selector exists in the markup', () => {
        const missing = [...js.matchAll(/querySelectorAll\('([^']+)'\)/g)]
            .map(m => m[1])
            .flatMap(sel => sel.split(/\s+/))
            .filter(part => part.startsWith('.'))
            .map(part => part.slice(1))
            .filter(cls => !htmlClasses.has(cls));
        equal(missing.join(', '), '', 'classes queried by app.js but absent from index.html');
    });

    it('importmap resolves every bare module specifier app.js imports', () => {
        const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
        const specifiers = [...js.matchAll(/from '([^']+)'|import\('([^']+)'\)/g)]
            .map(m => m[1] || m[2])
            .filter(s => !s.startsWith('.') && !s.startsWith('http'));
        const unresolved = specifiers.filter(
            s => !map[s] && !Object.keys(map).some(k => k.endsWith('/') && s.startsWith(k))
        );
        equal([...new Set(unresolved)].join(', '), '', 'bare specifiers missing from the importmap');
    });

    it('renders object names as text, never as interpolated innerHTML', () => {
        assert(
            !/innerHTML\s*=\s*`[^`]*\$\{[^}]*userData\.name/.test(js),
            'object names are interpolated into innerHTML — a name like <img onerror=…> would execute'
        );
    });

    it('does not dispose geometry or material shared with live scene objects', () => {
        const exportFn = /function exportSTL\(\)[\s\S]*?\n}/.exec(js)[0];
        assert(!/\.geometry\.dispose\(\)/.test(exportFn), 'exportSTL disposes geometry shared with the source mesh');
        assert(!/\.material\.dispose\(\)/.test(exportFn), 'exportSTL disposes material shared with the source mesh');
    });
});

describe('style.css palette', () => {
    it('defines every custom property it references', () => {
        const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
        const missing = [...used].filter(v => !(v in cssVars));
        equal(missing.join(', '), '', 'CSS variables used but never defined');
    });

    it('keeps body text readable on both surfaces (WCAG AA, 4.5:1)', () => {
        for (const bg of ['--bg-dark', '--bg-panel']) {
            const ratio = contrast(cssVars['--text-primary'], cssVars[bg]);
            assert(ratio >= 4.5, `--text-primary on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
        }
    });

    it('keeps secondary text readable (WCAG AA large/UI, 3:1)', () => {
        for (const bg of ['--bg-dark', '--bg-panel']) {
            const ratio = contrast(cssVars['--text-secondary'], cssVars[bg]);
            assert(ratio >= 3, `--text-secondary on ${bg} is ${ratio.toFixed(2)}:1, needs 3:1`);
        }
    });

    it('keeps accents visible without glare', () => {
        for (const name of ['--accent', '--accent-2', '--danger', '--success', '--warning']) {
            assert(name in cssVars, `${name} is not defined`);
            const lum = luminance(cssVars[name]);
            assert(lum <= 0.55, `${name} luminance ${lum.toFixed(2)} is too bright for a dark UI (max 0.55)`);
            const ratio = contrast(cssVars[name], cssVars['--bg-panel']);
            assert(ratio >= 3, `${name} on --bg-panel is ${ratio.toFixed(2)}:1, needs 3:1`);
        }
    });

    it('keeps the viewport background in step with the CSS shell', () => {
        const sceneBg = /scene\.background = new THREE\.Color\(0x([0-9a-fA-F]{6})\)/.exec(js);
        assert(sceneBg, 'scene background colour not found in app.js');
        equal('#' + sceneBg[1].toLowerCase(), cssVars['--bg-viewport'].toLowerCase(), 'viewport clear colour drifted from --bg-viewport');
    });
});
