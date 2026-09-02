// Mock data model for PrintMatch. No backend — everything lives here and in
// AppContext at runtime.

export const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Nylon"];

// Self-contained SVG shop-logo marks — no network dependency, so the app
// (and any static preview of it) never depends on an image host being
// reachable. Each shop gets a distinct icon + color so pins are easy to
// tell apart on the map. Base64-encoded (rather than percent-encoded) so
// the single-quoted attributes inside the SVG never collide with the
// quoting used when this URL is embedded in a CSS url(...) value, e.g. in
// the Leaflet marker HTML.
function shopLogo(inner) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${inner}</svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

const LOGO_RIVERSIDE = shopLogo(`
  <circle cx='32' cy='32' r='32' fill='#1F6F63'/>
  <path d='M24 16 H40 L34 30 H30 Z' fill='white'/>
  <circle cx='32' cy='40' r='5' fill='white'/>
  <path d='M12 24 L18 22 M10 30 L17 29' stroke='white' stroke-width='2.5' stroke-linecap='round'/>
`);

const LOGO_OAKHILL = shopLogo(`
  <circle cx='32' cy='32' r='32' fill='#6B5B95'/>
  <path d='M32 14 L46 22 V38 L32 46 L18 38 V22 Z' fill='none' stroke='white' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='32' cy='30' r='6' fill='white'/>
`);

const LOGO_CUBE_COIL = shopLogo(`
  <circle cx='32' cy='32' r='32' fill='#B4562B'/>
  <circle cx='32' cy='32' r='14' fill='none' stroke='white' stroke-width='3'/>
  <circle cx='32' cy='32' r='5' fill='white'/>
  <path d='M32 18 V14 M32 50 V46 M18 32 H14 M50 32 H46' stroke='white' stroke-width='3' stroke-linecap='round'/>
`);

const LOGO_GARAGE = shopLogo(`
  <circle cx='32' cy='32' r='32' fill='#4A5568'/>
  <path d='M18 40 L32 46 L46 40' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M18 32 L32 38 L46 32' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M18 24 L32 30 L46 24 L32 18 Z' fill='white'/>
`);

const LOGO_NORTH_END = shopLogo(`
  <circle cx='32' cy='32' r='32' fill='#2E5C8A'/>
  <path d='M32 14 L48 23 V41 L32 50 L16 41 V23 Z' fill='none' stroke='white' stroke-width='3' stroke-linejoin='round'/>
  <path d='M32 14 V32 M32 32 L48 23 M32 32 L16 23' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
`);

export const printers = [
  {
    id: "p1",
    name: "Riverside Rapid Prints",
    ownerName: "Dana K.",
    distanceMi: 0.8,
    location: [39.786, -89.644], // [lat, lng]
    serviceRadiusMi: 10,
    logoUrl: LOGO_RIVERSIDE,
    buildVolume: { x: 220, y: 220, z: 250 },
    materials: ["PLA", "PETG", "TPU"],
    turnaroundLabel: "Same day",
    status: "available",
    rating: 4.9,
    completedJobs: 312,
  },
  {
    id: "p2",
    name: "Oakhill Fab Lab",
    ownerName: "Marcus T.",
    distanceMi: 1.4,
    location: [39.791, -89.66],
    serviceRadiusMi: 6,
    logoUrl: LOGO_OAKHILL,
    buildVolume: { x: 300, y: 300, z: 400 },
    materials: ["PLA", "ABS", "Nylon"],
    turnaroundLabel: "24hr",
    status: "printing",
    rating: 4.7,
    completedJobs: 189,
  },
  {
    id: "p3",
    name: "Cube & Coil Studio",
    ownerName: "Priya S.",
    distanceMi: 2.1,
    location: [39.765, -89.625],
    serviceRadiusMi: 12,
    logoUrl: LOGO_CUBE_COIL,
    buildVolume: { x: 250, y: 210, z: 210 },
    materials: ["PLA", "PETG", "ABS", "TPU"],
    turnaroundLabel: "48hr",
    status: "available",
    rating: 4.8,
    completedJobs: 421,
  },
  {
    id: "p4",
    name: "Garage Layer Works",
    ownerName: "Leo F.",
    distanceMi: 3.5,
    location: [39.81, -89.61],
    serviceRadiusMi: 5,
    logoUrl: LOGO_GARAGE,
    buildVolume: { x: 180, y: 180, z: 200 },
    materials: ["PLA", "PETG"],
    turnaroundLabel: "24hr",
    status: "offline",
    rating: 4.5,
    completedJobs: 76,
  },
  {
    id: "p5",
    name: "North End Print Co.",
    ownerName: "Sam R.",
    distanceMi: 4.2,
    location: [39.825, -89.67],
    serviceRadiusMi: 15,
    logoUrl: LOGO_NORTH_END,
    buildVolume: { x: 350, y: 350, z: 400 },
    materials: ["PLA", "PETG", "ABS", "Nylon", "TPU"],
    turnaroundLabel: "Same day",
    status: "available",
    rating: 5.0,
    completedJobs: 540,
  },
];

export const jobs = [
  {
    id: "j1",
    buyerName: "Jamie L.",
    buyerNotes:
      "Need a replacement bracket for a shelf mount. Should be rigid and hold ~5kg.",
    material: "PETG",
    color: "Black",
    fileName: "shelf_bracket_v2.stl",
    fileType: "stl",
    dimensions: { x: 80, y: 60, z: 20 },
    quantity: 2,
    neededBy: "2026-09-05",
    status: "pending",
  },
  {
    id: "j2",
    buyerName: "Alex C.",
    buyerNotes: "Cosplay prop piece, needs to look clean — photo attached for reference.",
    material: "PLA",
    color: "Gold",
    fileName: "helmet_ref_photo.jpg",
    fileType: "photo",
    dimensions: { x: 150, y: 150, z: 100 },
    quantity: 1,
    neededBy: "2026-09-10",
    status: "pending",
  },
  {
    id: "j3",
    buyerName: "Morgan P.",
    buyerNotes: "Drone arm replacement, must be strong. Nylon preferred if available.",
    material: "Nylon",
    color: "Natural",
    fileName: "drone_arm.stl",
    fileType: "stl",
    dimensions: { x: 120, y: 30, z: 15 },
    quantity: 4,
    neededBy: "2026-09-06",
    status: "pending",
  },
];

export const quotes = [
  {
    id: "q1",
    jobId: "j-current",
    printerId: "p1",
    price: 18.5,
    etaHours: 6,
    material: "PETG",
    color: "Black",
  },
  {
    id: "q2",
    jobId: "j-current",
    printerId: "p3",
    price: 22.0,
    etaHours: 30,
    material: "PETG",
    color: "Black",
  },
  {
    id: "q3",
    jobId: "j-current",
    printerId: "p5",
    price: 16.0,
    etaHours: 10,
    material: "PETG",
    color: "Charcoal",
  },
];

export const chatMessages = [
  {
    id: "m1",
    senderRole: "owner",
    text: "Got your file, starting the print now. Should be ready in about 5 hours!",
    timestamp: "2026-09-02T09:15:00",
  },
  {
    id: "m2",
    senderRole: "buyer",
    text: "Awesome, thank you! Can you send a photo once it's done?",
    timestamp: "2026-09-02T09:17:00",
  },
  {
    id: "m3",
    senderRole: "owner",
    text: "Of course, will do.",
    timestamp: "2026-09-02T09:18:00",
  },
  {
    id: "m4",
    senderRole: "owner",
    imageUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='260'>
          <rect width='400' height='260' fill='#17385f'/>
          <g stroke='#e8752d' stroke-width='2' fill='none' opacity='0.85'>
            ${Array.from({ length: 14 })
              .map(
                (_, i) =>
                  `<rect x='${120 - i * 2}' y='${230 - i * 12}' width='${160 + i * 4}' height='10' rx='2'/>`
              )
              .join("")}
          </g>
        </svg>`
      ),
    text: "First layer looking great",
    timestamp: "2026-09-02T10:02:00",
  },
];

export const order = {
  id: "o1",
  quoteId: "q1",
  printerId: "p1",
  status: "printing",
  progressPct: 62,
  etaLabel: "2h 10m remaining",
  serviceFee: 2.5,
  messages: chatMessages,
};

export const earnings = {
  weekTotal: 214.5,
  monthTotal: 892.0,
  jobsCompletedMonth: 47,
  weeklyTrend: [30, 42, 18, 55, 25, 44.5, 0],
};

// The signed-in printer owner in this demo is Dana K. (printers[0]) —
// "my shop" fields (location, serviceRadiusMi, logoUrl, status) live on
// that printer record and are edited via AppContext's updateMyShop.
export const MY_PRINTER_ID = "p1";

export const ownerPrinters = [
  {
    id: "op1",
    name: "Bambu X1C #1",
    materials: ["PLA", "PETG", "TPU"],
    status: "available",
  },
  {
    id: "op2",
    name: "Prusa MK4",
    materials: ["PLA", "PETG", "ABS"],
    status: "printing",
  },
  {
    id: "op3",
    name: "Bambu X1C #2",
    materials: ["PLA", "PETG", "TPU", "Nylon"],
    status: "offline",
  },
];
