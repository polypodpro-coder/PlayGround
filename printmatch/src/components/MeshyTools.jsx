import { ExternalLink, WandSparkles, Wrench, Printer } from 'lucide-react';

const tools = [
  { name: 'Image to 3D', path: '/features/image-to-3d', description: 'Start from a photo or sketch. Use views of the same object when Meshy offers multi-view mode.' },
  { name: 'Text to 3D', path: '/features/text-to-3d', description: 'Describe your idea, create a model, and export the geometry for review.' },
  { name: 'Convert to STL', path: '/3d-tools/file-converter', description: 'Convert supported formats such as GLB and OBJ. Meshy describes single-file conversion as local browser processing.' },
  { name: 'Reduce polygons', path: '/3d-tools/polygon-reducer', description: 'Simplify a large mesh before importing. Our viewer accepts up to 10 MB and 150,000 triangles; check details after reduction.' },
  { name: 'Check and repair', path: '/3d-tools/stl-repair', description: 'Analyze mesh defects and use Meshy repair options. Check any credit charge in your Meshy account; still review size, fit, and strength.' },
];
const slicers = [
  ['Bambu Studio', 'bambu-studio'], ['OrcaSlicer', 'orcaslicer'], ['Ultimaker Cura', 'cura'],
  ['Creality Print', 'creality-print'], ['Elegoo Slicer', 'elegoo-slicer'], ['Lychee Slicer', 'lychee-slicer'],
  ['Flash Studio', 'flash-studio'], ['Snapmaker Orca', 'snapmaker-orca'],
];
function External({ href, children, className = '' }) { return <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 font-semibold text-accent ${className}`}>{children}<ExternalLink size={15} className="shrink-0" /><span className="sr-only"> (opens a new tab)</span></a>; }

export default function MeshyTools({ farm = false }) {
  return <section className="panel stack" aria-labelledby={farm ? 'farm-meshy-tools' : 'buyer-meshy-tools'}>
    <div><p className="eyebrow">MESHY TOOLKIT</p><h2 id={farm ? 'farm-meshy-tools' : 'buyer-meshy-tools'} className="section-heading mt-2">{farm ? 'Prepare a model for production review.' : 'Create, convert, and refine.'}</h2><p className="body-copy mt-3">These tools open on Meshy. Keep this tab open, then import your finished STL. Generation, plans, and any tool charges stay with your own account.</p></div>
    {!farm && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool, index) => <article key={tool.path} className="rounded-xl border border-navy/10 p-4">{index < 2 ? <WandSparkles size={20} className="mb-3 text-accent" /> : <Wrench size={20} className="mb-3 text-accent" />}<External href={'https://www.meshy.ai' + tool.path}>{tool.name}</External><p className="mt-3 text-sm leading-6 text-navy/65">{tool.description}</p></article>)}</div>}
    <details className="rounded-xl bg-navy/5 p-5" open={farm || undefined}>
      <summary className="cursor-pointer font-semibold">Slicer connections and advanced preparation</summary>
      <p className="mt-4 text-sm leading-6 text-navy/70">Meshy's printing guides use Print → Send to your slicer from its workspace. They require the slicer installed on your computer and a qualifying Meshy plan. This opens local software; it does not submit a print job to a farm.</p>
      <ul className="my-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{slicers.map(([name, slug]) => <li key={slug}><External href={'https://www.meshy.ai/integrations/' + slug}><Printer size={16} />{name}</External></li>)}</ul>
      <p className="text-sm leading-6 text-navy/70"><External href="https://www.meshy.ai/integrations/blender">Blender preparation guide</External><br />For experienced users: model cleanup, thickness and overhang checks, scale, orientation, and STL export. Follow Meshy's current plugin and plan requirements.</p>
      <p className="mt-4 text-sm leading-6 text-navy/65">A slicer or repair result still needs farm review for the intended material, machine, size, and use. Imported STL files contain geometry; colors, textures, and animations do not carry into this request workflow.</p>
    </details>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm"><External href="https://www.meshy.ai/integrations">All Meshy integrations</External><External href="https://www.meshy.ai/3d-tools">All Meshy web tools</External></div>
  </section>;
}
