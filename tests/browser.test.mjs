// End-to-end tests driving the real app in headless Chromium.
import path from 'node:path';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, assert, equal } from './lib/harness.mjs';
import { startServer } from './lib/server.mjs';
import { openApp } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let server, browser, page, consoleErrors;

export async function setup() {
    server = await startServer(ROOT);
    ({ browser, page, consoleErrors } = await openApp(server.url));
}

export async function teardown() {
    await browser?.close();
    await server?.close();
}

const objectCount = () => page.evaluate(() => window.__app.state.objects.length);
const addPrimitive = (shape) => page.click(`.prim-btn[data-shape="${shape}"]`);
const reset = () => page.evaluate(() => window.__app.reset());

async function download(action) {
    const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
    const file = path.join(os.tmpdir(), `test-${Date.now()}-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    return file;
}

describe('app boot', () => {
    it('loads without console or page errors', () => {
        equal(consoleErrors.join('\n'), '', 'console errors during load');
    });

    it('renders a WebGL viewport sized to its container', async () => {
        const ok = await page.evaluate(() => {
            const c = document.getElementById('viewport');
            return c.width > 0 && c.height > 0;
        });
        assert(ok, 'viewport canvas has no drawing buffer');
    });

    it('exposes boolean operations (CSG backend available)', async () => {
        const ready = await page.evaluate(() => window.__app.csgAvailable());
        assert(ready, 'CSG backend failed to load — boolean operations are dead');
    });
});

describe('primitives', () => {
    it('adds each primitive type', async () => {
        await reset();
        for (const shape of ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane']) {
            await addPrimitive(shape);
        }
        equal(await objectCount(), 6, 'not every primitive button added an object');
        const types = await page.evaluate(() => window.__app.state.objects.map(o => o.userData.type));
        equal(types.join(','), 'box,sphere,cylinder,cone,torus,plane');
    });

    it('lists objects in the scene panel and updates the status bar', async () => {
        equal(await page.locator('#object-list li').count(), 6);
        equal(await page.locator('#status-objects').textContent(), 'Objects: 6');
        const tris = await page.locator('#status-triangles').textContent();
        assert(/Triangles: [1-9]\d*/.test(tris), `status bar triangles not counted: ${tris}`);
    });

    it('selects the newest object and shows its properties', async () => {
        await page.waitForSelector('#object-properties:not(.hidden)');
        equal(await page.inputValue('#prop-name'), 'Plane_6');
    });
});

describe('selection', () => {
    it('selects an object by clicking it in the viewport', async () => {
        await reset();
        await addPrimitive('box');
        await page.evaluate(() => window.__app.selectObject(null));
        const box = await page.evaluate(() => window.__app.screenPositionOf(window.__app.state.objects[0]));
        await page.mouse.click(box.x, box.y);
        const name = await page.evaluate(() => window.__app.state.selected?.userData.name);
        equal(name, 'Box_1', 'clicking the object did not select it');
    });

    it('keeps the selection when the click was actually an orbit drag', async () => {
        const start = await page.evaluate(() => window.__app.screenPositionOf(window.__app.state.objects[0]));
        await page.mouse.move(start.x + 200, start.y + 120);
        await page.mouse.down();
        await page.mouse.move(start.x + 260, start.y + 150, { steps: 10 });
        await page.mouse.up();
        const name = await page.evaluate(() => window.__app.state.selected?.userData.name);
        equal(name, 'Box_1', 'orbiting the camera cleared the selection');
    });

    it('ignores hidden objects when picking', async () => {
        await page.evaluate(() => { window.__app.state.objects[0].visible = false; window.__app.selectObject(null); });
        const box = await page.evaluate(() => window.__app.screenPositionOf(window.__app.state.objects[0]));
        await page.mouse.click(box.x, box.y);
        const sel = await page.evaluate(() => window.__app.state.selected);
        equal(sel, null, 'a hidden object was selected by clicking through it');
        await page.evaluate(() => { window.__app.state.objects[0].visible = true; });
    });
});

describe('properties panel', () => {
    it('writes position, rotation and scale back to the mesh', async () => {
        await reset();
        await addPrimitive('box');
        await page.fill('#prop-pos-x', '2.5');
        await page.press('#prop-pos-x', 'Enter');
        await page.fill('#prop-rot-y', '90');
        await page.press('#prop-rot-y', 'Enter');
        await page.fill('#prop-scl-z', '3');
        await page.press('#prop-scl-z', 'Enter');
        const t = await page.evaluate(() => {
            const o = window.__app.state.selected;
            return { x: o.position.x, ry: +o.rotation.y.toFixed(4), sz: o.scale.z };
        });
        equal(t.x, 2.5);
        equal(t.ry, +(Math.PI / 2).toFixed(4));
        equal(t.sz, 3);
    });

    it('clamps scale to a positive value', async () => {
        await page.fill('#prop-scl-x', '0');
        await page.press('#prop-scl-x', 'Enter');
        const sx = await page.evaluate(() => window.__app.state.selected.scale.x);
        assert(sx > 0, `scale collapsed to ${sx}`);
    });

    it('escapes object names in the scene list', async () => {
        await page.fill('#prop-name', '<img src=x onerror="window.__pwned=1">');
        await page.press('#prop-name', 'Enter');
        const pwned = await page.evaluate(() => window.__pwned === 1 || !!document.querySelector('#object-list img'));
        assert(!pwned, 'object name was injected as HTML');
    });
});

describe('undo / redo', () => {
    it('undoes and redoes object creation', async () => {
        await reset();
        await addPrimitive('box');
        await addPrimitive('sphere');
        equal(await objectCount(), 2);
        await page.click('#btn-undo');
        equal(await objectCount(), 1, 'undo did not remove the sphere');
        await page.click('#btn-redo');
        equal(await objectCount(), 2, 'redo did not restore the sphere');
    });

    it('restores transforms, colour and visibility', async () => {
        await reset();
        await addPrimitive('box');
        await page.evaluate(() => {
            const o = window.__app.state.selected;
            o.position.set(1, 2, 3);
            o.material.color.set('#ff8844');
            o.visible = false;
            window.__app.saveUndoState();
        });
        await page.evaluate(() => { window.__app.state.objects[0].position.set(0, 0, 0); window.__app.saveUndoState(); });
        await page.click('#btn-undo');
        const o = await page.evaluate(() => {
            const m = window.__app.state.objects[0];
            return { p: m.position.toArray(), c: m.material.color.getHexString(), v: m.visible };
        });
        equal(o.p.join(','), '1,2,3', 'position not restored');
        equal(o.c, 'ff8844', 'colour not restored');
        equal(o.v, false, 'visibility not restored');
    });

    it('leaves no gizmo attached to a deleted object', async () => {
        await reset();
        await addPrimitive('box');
        await page.click('#btn-delete');
        await page.click('#btn-undo');
        const dangling = await page.evaluate(() => {
            const attached = window.__app.transformControls.object;
            return !!attached && !window.__app.state.objects.includes(attached);
        });
        assert(!dangling, 'transform gizmo still points at a removed mesh');
    });
});

describe('boolean operations', () => {
    it('subtracts one solid from another and keeps a valid mesh', async () => {
        await reset();
        await addPrimitive('box');
        await page.evaluate(() => {
            const s = window.__app.state.objects[0];
            s.position.set(0, 0.5, 0);
        });
        await addPrimitive('sphere');
        await page.evaluate(() => {
            window.__app.state.objects[1].position.set(0.4, 0.9, 0.4);
            window.__app.selectObject(window.__app.state.objects[0]);
        });
        await page.click('#btn-subtract');
        await page.waitForFunction(() => window.__app.state.objects.length === 1, null, { timeout: 15000 });
        const info = await page.evaluate(() => {
            const m = window.__app.state.objects[0];
            const pos = m.geometry.attributes.position;
            return { type: m.userData.type, verts: pos.count, finite: Array.from(pos.array).every(Number.isFinite) };
        });
        equal(info.type, 'boolean');
        assert(info.verts > 12, `boolean result has only ${info.verts} vertices`);
        assert(info.finite, 'boolean result contains NaN vertices');
    });

    it('survives an undo of the boolean', async () => {
        await page.click('#btn-undo');
        equal(await objectCount(), 2, 'undo did not bring both operands back');
    });

    it('refuses politely when there is nothing to combine', async () => {
        await reset();
        await addPrimitive('box');
        await page.click('#btn-union');
        const toast = await page.locator('.toast').last().textContent();
        assert(/at least 2/i.test(toast), `unexpected message: ${toast}`);
    });
});

describe('STL export', () => {
    it('writes a well-formed binary STL', async () => {
        await reset();
        await addPrimitive('box');
        await page.selectOption('#export-format', 'binary');
        await page.fill('#export-filename', 'unit-box');
        const file = await download(() => page.click('#btn-export'));
        const buf = readFileSync(file);
        assert(path.basename(file).endsWith('unit-box.stl'), `unexpected filename ${path.basename(file)}`);
        const triangles = buf.readUInt32LE(80);
        equal(triangles, 12, 'a cube should export as 12 triangles');
        equal(buf.length, 84 + triangles * 50, 'binary STL length does not match its triangle count');
    });

    it('writes ASCII STL when asked', async () => {
        await page.selectOption('#export-format', 'ascii');
        const file = await download(() => page.click('#btn-export'));
        const text = readFileSync(file, 'utf8');
        assert(text.startsWith('solid'), 'ASCII STL missing solid header');
        equal((text.match(/facet normal/g) || []).length, 12);
    });

    it('leaves the scene renderable after exporting', async () => {
        const info = await page.evaluate(() => {
            const { renderer, scene, camera, state } = window.__app;
            renderer.render(scene, camera);
            return { drawn: renderer.info.render.triangles, objects: state.objects.length };
        });
        equal(info.objects, 1, 'export removed objects from the scene');
        assert(info.drawn > 0, 'nothing renders after exporting');
        equal(consoleErrors.join('\n'), '', 'WebGL errors after export');
    });

    it('bakes world transforms into the exported geometry', async () => {
        await reset();
        await addPrimitive('box');
        await page.evaluate(() => window.__app.state.selected.position.set(10, 10, 10));
        await page.selectOption('#export-format', 'ascii');
        const file = await download(() => page.click('#btn-export'));
        const coords = [...readFileSync(file, 'utf8').matchAll(/vertex ([-\d.e+]+) ([-\d.e+]+) ([-\d.e+]+)/g)]
            .flatMap(m => [+m[1], +m[2], +m[3]]);
        assert(Math.min(...coords) > 9, 'exported vertices ignore the object transform');
    });

    it('excludes hidden objects', async () => {
        await reset();
        await addPrimitive('box');
        await addPrimitive('sphere');
        await page.evaluate(() => { window.__app.state.objects[1].visible = false; });
        await page.selectOption('#export-format', 'binary');
        const file = await download(() => page.click('#btn-export'));
        equal(readFileSync(file).readUInt32LE(80), 12, 'hidden object was exported');
    });

    it('refuses to export an empty scene', async () => {
        await reset();
        await page.click('#btn-export');
        const toast = await page.locator('.toast').last().textContent();
        assert(/no objects/i.test(toast), `unexpected message: ${toast}`);
    });
});

describe('keyboard shortcuts', () => {
    it('switches transform modes with G / R / S', async () => {
        await reset();
        await addPrimitive('box');
        for (const [key, mode] of [['g', 'translate'], ['r', 'rotate'], ['s', 'scale']]) {
            await page.keyboard.press(key);
            equal(await page.evaluate(() => window.__app.transformControls.mode), mode, `${key} did not switch mode`);
        }
    });

    it('does not fire shortcuts while typing in a field', async () => {
        await page.click('#prop-name');
        await page.keyboard.press('Delete');
        equal(await objectCount(), 1, 'Delete inside a text field removed the object');
    });

    it('undoes with Ctrl+Z outside of fields', async () => {
        await page.click('#viewport');
        await addPrimitive('sphere');
        await page.keyboard.press('Control+z');
        equal(await objectCount(), 1, 'Ctrl+Z did not undo');
    });
});

describe('reference image', () => {
    it('loads an image, shows it in the viewport and honours its controls', async () => {
        await reset();
        const png = readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ref.png'));
        await page.setInputFiles('#ref-image-input', { name: 'ref.png', mimeType: 'image/png', buffer: png });
        await page.waitForFunction(() => window.__app.state.refMesh !== null, null, { timeout: 10000 });
        await page.waitForSelector('#ref-image-preview:not(.hidden)');

        await page.fill('#ref-opacity', '20');
        await page.dispatchEvent('#ref-opacity', 'input');
        equal(await page.evaluate(() => +window.__app.state.refMesh.material.opacity.toFixed(2)), 0.2);

        await page.uncheck('#ref-show-in-viewport');
        equal(await page.evaluate(() => window.__app.state.refMesh.visible), false, 'hiding the reference had no effect');
        await page.check('#ref-show-in-viewport');

        await page.selectOption('#ref-plane', 'left');
        equal(await page.evaluate(() => window.__app.state.refMesh.position.x), -5, 'plane preset not applied');
    });

    it('never exports the reference plane as geometry', async () => {
        await addPrimitive('box');
        await page.selectOption('#export-format', 'binary');
        const file = await download(() => page.click('#btn-export'));
        equal(readFileSync(file).readUInt32LE(80), 12, 'reference image leaked into the STL');
    });

    it('removes the reference cleanly', async () => {
        await page.click('#btn-remove-ref');
        equal(await page.evaluate(() => window.__app.state.refMesh), null);
        await page.waitForSelector('#ref-image-dropzone:not(.hidden)');
    });
});

describe('camera presets', () => {
    it('moves the camera and marks the active button', async () => {
        for (const [id, axis] of [['btn-view-front', 'z'], ['btn-view-top', 'y'], ['btn-view-right', 'x']]) {
            await page.click(`#${id}`);
            const pos = await page.evaluate(a => window.__app.camera.position[a], axis);
            assert(Math.abs(pos) > 5, `${id} did not move the camera along ${axis} (got ${pos})`);
            assert(await page.locator(`#${id}`).evaluate(el => el.classList.contains('active')), `${id} not marked active`);
        }
    });
});

describe('no leaks after a session of edits', () => {
    it('finishes with a clean console', () => {
        equal(consoleErrors.join('\n'), '', 'console errors accumulated during the run');
    });
});
