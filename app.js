import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { CSG } from 'three/addons/math/CSG.js';

// ── App State ──────────────────────────────────────────────────────────────
const state = {
    objects: [],
    selected: null,
    transformMode: 'translate',
    undoStack: [],
    redoStack: [],
    refImage: null,
    refMesh: null,
    objectCounter: 0,
};

// ── Scene Setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(5, 4, 6);
camera.lookAt(0, 0, 0);

// Orbit Controls
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.minDistance = 1;
orbitControls.maxDistance = 100;

// Transform Controls
const transformControls = new TransformControls(camera, canvas);
transformControls.setSize(0.75);
scene.add(transformControls.getHelper());

transformControls.addEventListener('dragging-changed', (e) => {
    orbitControls.enabled = !e.value;
});

transformControls.addEventListener('objectChange', () => {
    updatePropertiesPanel();
});

transformControls.addEventListener('mouseUp', () => {
    saveUndoState();
});

// ── Lighting ───────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8899bb, 0.3);
fillLight.position.set(-3, 5, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x443322, 0.3);
scene.add(hemiLight);

// ── Grid ───────────────────────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(20, 20, 0x3a4a6a, 0x2a3a5e);
gridHelper.material.opacity = 0.5;
gridHelper.material.transparent = true;
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(2);
scene.add(axesHelper);

// ── Raycaster ──────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ── Resize ─────────────────────────────────────────────────────────────────
function onResize() {
    const container = document.getElementById('viewport-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ── Utility ────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function radToDeg(r) { return r * (180 / Math.PI); }
function degToRad(d) { return d * (Math.PI / 180); }

// ── Object Management ──────────────────────────────────────────────────────
function createMaterial(color = 0x4a90d9) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.1,
        flatShading: false,
    });
}

function addPrimitive(type) {
    let geometry;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)}_${++state.objectCounter}`;

    switch (type) {
        case 'box':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(0.5, 32, 24);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(0.5, 1, 32);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(0.5, 0.18, 24, 48);
            break;
        case 'plane':
            geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
            break;
        default:
            return;
    }

    const mesh = new THREE.Mesh(geometry, createMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.name = name;
    mesh.userData.type = type;
    mesh.position.y = type === 'plane' ? 0.01 : 0.5;

    if (type === 'plane') {
        mesh.rotation.x = -Math.PI / 2;
    }

    scene.add(mesh);
    state.objects.push(mesh);

    selectObject(mesh);
    updateObjectList();
    updateStatusBar();
    saveUndoState();
    showToast(`Added ${name}`, 'success');
}

function selectObject(obj) {
    state.selected = obj;

    if (obj) {
        transformControls.attach(obj);
    } else {
        transformControls.detach();
    }

    updateObjectList();
    updatePropertiesPanel();
}

function deleteSelected() {
    if (!state.selected) return;
    const obj = state.selected;
    transformControls.detach();
    scene.remove(obj);
    obj.geometry.dispose();
    obj.material.dispose();
    state.objects = state.objects.filter(o => o !== obj);
    state.selected = null;
    updateObjectList();
    updatePropertiesPanel();
    updateStatusBar();
    saveUndoState();
    showToast('Object deleted');
}

function duplicateSelected() {
    if (!state.selected) return;
    const src = state.selected;
    const mesh = new THREE.Mesh(src.geometry.clone(), src.material.clone());
    mesh.position.copy(src.position).add(new THREE.Vector3(1, 0, 1));
    mesh.rotation.copy(src.rotation);
    mesh.scale.copy(src.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.name = `${src.userData.type || 'Object'}_${++state.objectCounter}`;
    mesh.userData.type = src.userData.type;

    scene.add(mesh);
    state.objects.push(mesh);
    selectObject(mesh);
    updateObjectList();
    updateStatusBar();
    saveUndoState();
    showToast(`Duplicated as ${mesh.userData.name}`, 'success');
}

// ── Undo / Redo ────────────────────────────────────────────────────────────
function serializeState() {
    return state.objects.map(obj => ({
        name: obj.userData.name,
        type: obj.userData.type,
        position: obj.position.toArray(),
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: obj.scale.toArray(),
        color: obj.material.color.getHex(),
        wireframe: obj.material.wireframe,
        geometryType: obj.userData.type,
        visible: obj.visible,
    }));
}

function restoreState(snapshot) {
    // Remove current objects
    state.objects.forEach(obj => {
        transformControls.detach();
        scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
    });
    state.objects = [];
    state.selected = null;

    // Restore from snapshot
    snapshot.forEach(data => {
        let geometry;
        switch (data.geometryType) {
            case 'box': geometry = new THREE.BoxGeometry(1, 1, 1); break;
            case 'sphere': geometry = new THREE.SphereGeometry(0.5, 32, 24); break;
            case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
            case 'cone': geometry = new THREE.ConeGeometry(0.5, 1, 32); break;
            case 'torus': geometry = new THREE.TorusGeometry(0.5, 0.18, 24, 48); break;
            case 'plane': geometry = new THREE.PlaneGeometry(2, 2, 1, 1); break;
            default: geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        const mat = createMaterial(data.color);
        mat.wireframe = data.wireframe;
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.fromArray(data.position);
        mesh.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
        mesh.scale.fromArray(data.scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.name = data.name;
        mesh.userData.type = data.geometryType;
        mesh.visible = data.visible;
        scene.add(mesh);
        state.objects.push(mesh);
    });

    updateObjectList();
    updatePropertiesPanel();
    updateStatusBar();
}

function saveUndoState() {
    state.undoStack.push(serializeState());
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
}

function undo() {
    if (state.undoStack.length < 2) return;
    state.redoStack.push(state.undoStack.pop());
    restoreState(state.undoStack[state.undoStack.length - 1]);
}

function redo() {
    if (state.redoStack.length === 0) return;
    const snap = state.redoStack.pop();
    state.undoStack.push(snap);
    restoreState(snap);
}

// Save initial empty state
saveUndoState();

// ── Boolean Operations ─────────────────────────────────────────────────────
function performBoolean(operation) {
    if (state.objects.length < 2) {
        showToast('Need at least 2 objects for boolean operations', 'error');
        return;
    }

    if (!state.selected) {
        showToast('Select the target object first', 'error');
        return;
    }

    // Use the selected object as A and the next object in the list as B
    const objA = state.selected;
    const otherObjects = state.objects.filter(o => o !== objA);

    if (otherObjects.length === 0) {
        showToast('Need a second object', 'error');
        return;
    }

    // Prompt-like: use the last added object that isn't selected
    const objB = otherObjects[otherObjects.length - 1];

    try {
        // Update matrices
        objA.updateMatrix();
        objB.updateMatrix();

        let resultCSG;
        const csgA = CSG.fromMesh(objA);
        const csgB = CSG.fromMesh(objB);

        switch (operation) {
            case 'union':
                resultCSG = csgA.union(csgB);
                break;
            case 'subtract':
                resultCSG = csgA.subtract(csgB);
                break;
            case 'intersect':
                resultCSG = csgA.intersect(csgB);
                break;
        }

        const resultMesh = CSG.toMesh(resultCSG, objA.matrix, objA.material.clone());
        resultMesh.castShadow = true;
        resultMesh.receiveShadow = true;
        resultMesh.userData.name = `Boolean_${++state.objectCounter}`;
        resultMesh.userData.type = 'boolean';

        // Remove originals
        transformControls.detach();
        scene.remove(objA);
        scene.remove(objB);
        objA.geometry.dispose();
        objA.material.dispose();
        objB.geometry.dispose();
        objB.material.dispose();
        state.objects = state.objects.filter(o => o !== objA && o !== objB);

        scene.add(resultMesh);
        state.objects.push(resultMesh);
        selectObject(resultMesh);
        updateObjectList();
        updateStatusBar();
        saveUndoState();
        showToast(`Boolean ${operation} complete`, 'success');
    } catch (err) {
        console.error('Boolean operation failed:', err);
        showToast(`Boolean ${operation} failed: ${err.message}`, 'error');
    }
}

// ── Reference Image ────────────────────────────────────────────────────────
function loadReferenceImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        state.refImage = dataUrl;

        // Show preview
        const preview = document.getElementById('ref-image-preview');
        const dropzone = document.getElementById('ref-image-dropzone');
        const previewImg = document.getElementById('ref-preview-img');
        previewImg.src = dataUrl;
        preview.classList.remove('hidden');
        dropzone.classList.add('hidden');

        // Add to 3D viewport
        addRefImageToViewport(dataUrl);
    };
    reader.readAsDataURL(file);
}

function addRefImageToViewport(dataUrl) {
    removeRefImageFromViewport();

    const texture = new THREE.TextureLoader().load(dataUrl, (tex) => {
        const aspect = tex.image.width / tex.image.height;
        const height = 5;
        const width = height * aspect;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: parseFloat(document.getElementById('ref-opacity').value) / 100,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isReference = true;
        applyRefPlane(mesh);
        scene.add(mesh);
        state.refMesh = mesh;
    });
}

function applyRefPlane(mesh) {
    const plane = document.getElementById('ref-plane').value;
    mesh.position.set(0, 2.5, 0);
    mesh.rotation.set(0, 0, 0);

    switch (plane) {
        case 'front':
            mesh.position.z = -5;
            break;
        case 'back':
            mesh.position.z = 5;
            mesh.rotation.y = Math.PI;
            break;
        case 'left':
            mesh.position.x = -5;
            mesh.rotation.y = Math.PI / 2;
            break;
        case 'right':
            mesh.position.x = 5;
            mesh.rotation.y = -Math.PI / 2;
            break;
        case 'top':
            mesh.position.set(0, 5, 0);
            mesh.rotation.x = -Math.PI / 2;
            break;
        case 'bottom':
            mesh.position.set(0, -0.01, 0);
            mesh.rotation.x = Math.PI / 2;
            break;
    }
}

function removeRefImageFromViewport() {
    if (state.refMesh) {
        scene.remove(state.refMesh);
        state.refMesh.geometry.dispose();
        state.refMesh.material.map?.dispose();
        state.refMesh.material.dispose();
        state.refMesh = null;
    }
}

// ── STL Export ──────────────────────────────────────────────────────────────
function exportSTL() {
    if (state.objects.length === 0) {
        showToast('No objects to export', 'error');
        return;
    }

    const format = document.getElementById('export-format').value;
    const filename = document.getElementById('export-filename').value || 'model';

    // Create a temporary group for export (excludes reference images, grid, etc.)
    const exportGroup = new THREE.Group();
    state.objects.forEach(obj => {
        if (obj.visible) {
            const clone = obj.clone();
            clone.updateMatrix();
            exportGroup.add(clone);
        }
    });

    const exporter = new STLExporter();
    const binary = format === 'binary';
    const result = exporter.parse(exportGroup, { binary });

    // Download
    let blob;
    if (binary) {
        blob = new Blob([result], { type: 'application/octet-stream' });
    } else {
        blob = new Blob([result], { type: 'text/plain' });
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.stl`;
    link.click();
    URL.revokeObjectURL(link.href);

    // Clean up clones
    exportGroup.children.forEach(child => {
        child.geometry.dispose();
        child.material.dispose();
    });

    showToast(`Exported ${filename}.stl (${binary ? 'binary' : 'ASCII'})`, 'success');
}

// ── UI Updates ─────────────────────────────────────────────────────────────
function updateObjectList() {
    const list = document.getElementById('object-list');
    list.innerHTML = '';

    state.objects.forEach((obj) => {
        const li = document.createElement('li');
        li.className = obj === state.selected ? 'selected' : '';
        li.innerHTML = `
            <span class="obj-color" style="background:${obj.material.color ? '#' + obj.material.color.getHexString() : '#4a90d9'}"></span>
            <span>${obj.userData.name}</span>
            <span class="obj-visibility" data-obj="${obj.userData.name}">${obj.visible ? '&#128065;' : '&#128064;'}</span>
        `;
        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('obj-visibility')) {
                obj.visible = !obj.visible;
                updateObjectList();
                return;
            }
            selectObject(obj);
        });
        list.appendChild(li);
    });
}

function updatePropertiesPanel() {
    const noSel = document.getElementById('no-selection');
    const props = document.getElementById('object-properties');

    if (!state.selected) {
        noSel.classList.remove('hidden');
        props.classList.add('hidden');
        return;
    }

    noSel.classList.add('hidden');
    props.classList.remove('hidden');

    const obj = state.selected;
    document.getElementById('prop-name').value = obj.userData.name;
    document.getElementById('prop-pos-x').value = obj.position.x.toFixed(2);
    document.getElementById('prop-pos-y').value = obj.position.y.toFixed(2);
    document.getElementById('prop-pos-z').value = obj.position.z.toFixed(2);
    document.getElementById('prop-rot-x').value = radToDeg(obj.rotation.x).toFixed(1);
    document.getElementById('prop-rot-y').value = radToDeg(obj.rotation.y).toFixed(1);
    document.getElementById('prop-rot-z').value = radToDeg(obj.rotation.z).toFixed(1);
    document.getElementById('prop-scl-x').value = obj.scale.x.toFixed(2);
    document.getElementById('prop-scl-y').value = obj.scale.y.toFixed(2);
    document.getElementById('prop-scl-z').value = obj.scale.z.toFixed(2);
    document.getElementById('prop-color').value = '#' + obj.material.color.getHexString();
    document.getElementById('prop-wireframe').checked = obj.material.wireframe;
}

function updateStatusBar() {
    document.getElementById('status-objects').textContent = `Objects: ${state.objects.length}`;
    let triangles = 0;
    state.objects.forEach(obj => {
        if (obj.geometry.index) {
            triangles += obj.geometry.index.count / 3;
        } else {
            triangles += obj.geometry.attributes.position.count / 3;
        }
    });
    document.getElementById('status-triangles').textContent = `Triangles: ${Math.floor(triangles)}`;
}

// ── Camera Presets ─────────────────────────────────────────────────────────
function setCameraView(view) {
    const dist = 8;
    const target = new THREE.Vector3(0, 1, 0);

    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));

    switch (view) {
        case 'front':
            camera.position.set(0, 1, dist);
            document.getElementById('btn-view-front').classList.add('active');
            break;
        case 'top':
            camera.position.set(0, dist, 0.01);
            document.getElementById('btn-view-top').classList.add('active');
            break;
        case 'right':
            camera.position.set(dist, 1, 0);
            document.getElementById('btn-view-right').classList.add('active');
            break;
        case 'persp':
            camera.position.set(5, 4, 6);
            document.getElementById('btn-view-persp').classList.add('active');
            break;
    }

    camera.lookAt(target);
    orbitControls.target.copy(target);
    orbitControls.update();
}

// ── Event Listeners ────────────────────────────────────────────────────────

// Primitive buttons
document.querySelectorAll('.prim-btn').forEach(btn => {
    btn.addEventListener('click', () => addPrimitive(btn.dataset.shape));
});

// Transform mode buttons
document.getElementById('btn-select').addEventListener('click', () => {
    transformControls.detach();
    setActiveToolButton('btn-select');
});
document.getElementById('btn-move').addEventListener('click', () => {
    state.transformMode = 'translate';
    transformControls.setMode('translate');
    if (state.selected) transformControls.attach(state.selected);
    setActiveToolButton('btn-move');
});
document.getElementById('btn-rotate').addEventListener('click', () => {
    state.transformMode = 'rotate';
    transformControls.setMode('rotate');
    if (state.selected) transformControls.attach(state.selected);
    setActiveToolButton('btn-rotate');
});
document.getElementById('btn-scale').addEventListener('click', () => {
    state.transformMode = 'scale';
    transformControls.setMode('scale');
    if (state.selected) transformControls.attach(state.selected);
    setActiveToolButton('btn-scale');
});

function setActiveToolButton(id) {
    document.querySelectorAll('.toolbar-center .tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Boolean operations
document.getElementById('btn-union').addEventListener('click', () => performBoolean('union'));
document.getElementById('btn-subtract').addEventListener('click', () => performBoolean('subtract'));
document.getElementById('btn-intersect').addEventListener('click', () => performBoolean('intersect'));

// Undo / Redo
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// Export
document.getElementById('btn-export').addEventListener('click', exportSTL);

// Delete / Duplicate
document.getElementById('btn-delete').addEventListener('click', deleteSelected);
document.getElementById('btn-duplicate').addEventListener('click', duplicateSelected);

// Camera views
document.getElementById('btn-view-front').addEventListener('click', () => setCameraView('front'));
document.getElementById('btn-view-top').addEventListener('click', () => setCameraView('top'));
document.getElementById('btn-view-right').addEventListener('click', () => setCameraView('right'));
document.getElementById('btn-view-persp').addEventListener('click', () => setCameraView('persp'));

// Properties inputs
function bindPropInput(id, apply) {
    const el = document.getElementById(id);
    el.addEventListener('change', () => {
        if (!state.selected) return;
        apply(state.selected, parseFloat(el.value) || 0);
        saveUndoState();
    });
}

bindPropInput('prop-pos-x', (obj, v) => { obj.position.x = v; });
bindPropInput('prop-pos-y', (obj, v) => { obj.position.y = v; });
bindPropInput('prop-pos-z', (obj, v) => { obj.position.z = v; });
bindPropInput('prop-rot-x', (obj, v) => { obj.rotation.x = degToRad(v); });
bindPropInput('prop-rot-y', (obj, v) => { obj.rotation.y = degToRad(v); });
bindPropInput('prop-rot-z', (obj, v) => { obj.rotation.z = degToRad(v); });
bindPropInput('prop-scl-x', (obj, v) => { obj.scale.x = Math.max(0.01, v); });
bindPropInput('prop-scl-y', (obj, v) => { obj.scale.y = Math.max(0.01, v); });
bindPropInput('prop-scl-z', (obj, v) => { obj.scale.z = Math.max(0.01, v); });

document.getElementById('prop-name').addEventListener('change', (e) => {
    if (state.selected) {
        state.selected.userData.name = e.target.value;
        updateObjectList();
    }
});

document.getElementById('prop-color').addEventListener('input', (e) => {
    if (state.selected) {
        state.selected.material.color.set(e.target.value);
        updateObjectList();
    }
});

document.getElementById('prop-wireframe').addEventListener('change', (e) => {
    if (state.selected) {
        state.selected.material.wireframe = e.target.checked;
    }
});

// Reference Image
const dropzone = document.getElementById('ref-image-dropzone');
const refInput = document.getElementById('ref-image-input');

dropzone.addEventListener('click', () => refInput.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        loadReferenceImage(e.dataTransfer.files[0]);
    }
});

refInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadReferenceImage(e.target.files[0]);
    }
});

document.getElementById('ref-opacity').addEventListener('input', (e) => {
    if (state.refMesh) {
        state.refMesh.material.opacity = parseFloat(e.target.value) / 100;
    }
});

document.getElementById('ref-show-in-viewport').addEventListener('change', (e) => {
    if (state.refMesh) {
        state.refMesh.visible = e.target.checked;
    }
});

document.getElementById('ref-plane').addEventListener('change', () => {
    if (state.refMesh) {
        applyRefPlane(state.refMesh);
    }
});

document.getElementById('btn-remove-ref').addEventListener('click', () => {
    removeRefImageFromViewport();
    state.refImage = null;
    document.getElementById('ref-image-preview').classList.add('hidden');
    document.getElementById('ref-image-dropzone').classList.remove('hidden');
    refInput.value = '';
});

// Viewport click selection
canvas.addEventListener('click', (e) => {
    // Don't interfere with transform controls
    if (transformControls.dragging) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(state.objects);

    if (intersects.length > 0) {
        selectObject(intersects[0].object);
    } else {
        selectObject(null);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
    } else if (e.key === 'g') {
        document.getElementById('btn-move').click();
    } else if (e.key === 'r') {
        document.getElementById('btn-rotate').click();
    } else if (e.key === 's' && !e.ctrlKey) {
        document.getElementById('btn-scale').click();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
    } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
    } else if (e.key === 'Escape') {
        selectObject(null);
    } else if (e.key === '1') {
        setCameraView('front');
    } else if (e.key === '3') {
        setCameraView('right');
    } else if (e.key === '7') {
        setCameraView('top');
    } else if (e.key === '5') {
        setCameraView('persp');
    }
});

// ── Render Loop ────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}

animate();

// ── Initial state ──────────────────────────────────────────────────────────
updateStatusBar();
console.log('3D Model Generator loaded. Use the toolbar to add primitives and export as STL.');
