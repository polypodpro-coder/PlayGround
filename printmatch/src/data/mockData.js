// Mock data model for Poly POD. No backend — everything lives here and in
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

// Self-contained placeholder "finished print" photos for shop portfolios —
// same rationale as the logos: no network dependency. Each is a simple
// layered-print silhouette tinted to the shop's brand color, with a
// slightly different profile per index so a gallery of 3 doesn't look
// like 3 copies of the same image.
function portfolioImage(bg, seed) {
  const bars = Array.from({ length: 10 }, (_, i) => {
    const width = 70 + ((seed * 7 + i * 13) % 50);
    const x = 100 - width / 2 + ((seed * 3 + i) % 10) - 5;
    return `<rect x='${x}' y='${150 - i * 12}' width='${width}' height='9' rx='2'/>`;
  }).join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 160'>
    <rect width='200' height='160' fill='${bg}'/>
    <g stroke='white' stroke-width='1.5' fill='none' opacity='0.9'>${bars}</g>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

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
    bio: "Two Bambu X1Cs running most days, specializing in fast-turnaround functional parts. I'll flag any print issues before starting, not after.",
    pricingRates: { PLA: 0.06, PETG: 0.08, TPU: 0.14 },
    shopPaused: false,
    pausedUntil: null,
    portfolio: [
      { id: "p1-1", imageUrl: portfolioImage("#1F6F63", 1), caption: "Articulated robot arm, PETG" },
      { id: "p1-2", imageUrl: portfolioImage("#1F6F63", 2), caption: "Custom drone mount, TPU" },
      { id: "p1-3", imageUrl: portfolioImage("#1F6F63", 3), caption: "Cable organizer set, PLA" },
    ],
    reviews: [
      { id: "p1-r1", buyerName: "Jamie L.", rating: 5, text: "Fast turnaround and the bracket fit perfectly. Would order again.", date: "2026-08-22" },
      { id: "p1-r2", buyerName: "Priya N.", rating: 5, text: "Dana kept me updated the whole time with photos. Great communication.", date: "2026-08-10" },
      { id: "p1-r3", buyerName: "Tom R.", rating: 4, text: "Solid print quality, arrived a few hours later than quoted.", date: "2026-07-30" },
    ],
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
    bio: "Community fab lab open evenings and weekends. Good for engineering parts that need tighter tolerances — happy to talk through fit and function before you order.",
    pricingRates: { PLA: 0.07, ABS: 0.09, Nylon: 0.16 },
    shopPaused: false,
    pausedUntil: null,
    portfolio: [
      { id: "p2-1", imageUrl: portfolioImage("#6B5B95", 1), caption: "Enclosure prototype, ABS" },
      { id: "p2-2", imageUrl: portfolioImage("#6B5B95", 2), caption: "Gear train test set, Nylon" },
    ],
    reviews: [
      { id: "p2-r1", buyerName: "Alex C.", rating: 5, text: "Nailed the tolerances on a tricky gear part on the first try.", date: "2026-08-15" },
      { id: "p2-r2", buyerName: "Devon W.", rating: 4, text: "Good quality, queue was a bit longer than the 24hr estimate.", date: "2026-07-28" },
    ],
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
    bio: "Small studio focused on detail work — minis, props, and anything with fine features. I always send a first-layer photo before committing to the full print.",
    pricingRates: { PLA: 0.06, PETG: 0.08, ABS: 0.09, TPU: 0.13 },
    shopPaused: false,
    pausedUntil: null,
    portfolio: [
      { id: "p3-1", imageUrl: portfolioImage("#B4562B", 1), caption: "Miniature terrain set, PLA" },
      { id: "p3-2", imageUrl: portfolioImage("#B4562B", 2), caption: "Phone stand batch, PETG" },
      { id: "p3-3", imageUrl: portfolioImage("#B4562B", 3), caption: "Flexible phone case, TPU" },
    ],
    reviews: [
      { id: "p3-r1", buyerName: "Morgan P.", rating: 5, text: "Incredible detail on a mini terrain piece. Will be back.", date: "2026-08-25" },
      { id: "p3-r2", buyerName: "Sasha K.", rating: 5, text: "Priya double-checked my file and caught a wall-thickness issue before printing.", date: "2026-08-01" },
      { id: "p3-r3", buyerName: "Chris B.", rating: 4, text: "Great print, 48hr estimate ran closer to 60.", date: "2026-07-12" },
    ],
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
    bio: "One-printer garage shop — I do this on the side, so turnaround depends on my day job schedule. Budget-friendly for straightforward PLA/PETG parts.",
    pricingRates: { PLA: 0.05, PETG: 0.07 },
    shopPaused: true,
    pausedUntil: "2026-09-09",
    portfolio: [
      { id: "p4-1", imageUrl: portfolioImage("#4A5568", 1), caption: "Tool organizer tray, PLA" },
    ],
    reviews: [
      { id: "p4-r1", buyerName: "Riley H.", rating: 4, text: "Good value, straightforward garage-shop print job.", date: "2026-07-18" },
    ],
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
    bio: "Full production farm — a dozen printers running around the clock. If you need it fast and in volume, this is the shop for it.",
    pricingRates: { PLA: 0.05, PETG: 0.07, ABS: 0.08, Nylon: 0.14, TPU: 0.12 },
    shopPaused: false,
    pausedUntil: null,
    portfolio: [
      { id: "p5-1", imageUrl: portfolioImage("#2E5C8A", 1), caption: "Multi-color sign lettering, PLA" },
      { id: "p5-2", imageUrl: portfolioImage("#2E5C8A", 2), caption: "Structural bracket batch, Nylon" },
      { id: "p5-3", imageUrl: portfolioImage("#2E5C8A", 3), caption: "Gasket prototype run, TPU" },
    ],
    reviews: [
      { id: "p5-r1", buyerName: "Nina V.", rating: 5, text: "Best turnaround of any shop I've used on here. Same-day, as promised.", date: "2026-08-27" },
      { id: "p5-r2", buyerName: "Owen T.", rating: 5, text: "Five for five on quality across multiple orders now.", date: "2026-08-19" },
      { id: "p5-r3", buyerName: "Faith A.", rating: 5, text: "Handles big build volumes well, printed an oversized part no one else could.", date: "2026-08-02" },
    ],
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

// A buyer's order history — one active order plus a couple of past ones,
// so the Orders tab has something to list besides a single in-flight job.
export const orders = [
  {
    id: "o1",
    printerId: "p1",
    status: "printing",
    progressPct: 62,
    etaLabel: "2h 10m remaining",
    printCost: 18.5,
    serviceFee: 2.5,
    material: "PETG",
    color: "Black",
    createdAt: "2026-09-02T08:50:00",
    messages: chatMessages,
    viewed: false,
  },
  {
    id: "o2",
    printerId: "p3",
    status: "completed",
    progressPct: 100,
    etaLabel: "Delivered",
    printCost: 24.0,
    serviceFee: 3.0,
    material: "ABS",
    color: "Gray",
    createdAt: "2026-08-20T14:00:00",
    messages: [],
    viewed: true,
    rated: true,
  },
  {
    id: "o3",
    printerId: "p5",
    status: "completed",
    progressPct: 100,
    etaLabel: "Delivered",
    printCost: 12.0,
    serviceFee: 2.0,
    material: "PLA",
    color: "White",
    createdAt: "2026-08-05T10:30:00",
    messages: [],
    viewed: true,
    rated: false,
  },
];

export const earnings = {
  weekTotal: 214.5,
  monthTotal: 892.0,
  jobsCompletedMonth: 47,
  weeklyTrend: [30, 42, 18, 55, 25, 44.5, 0],
  topMaterial: "PETG",
  busiestDay: "Thursday",
  repeatCustomerPct: 38,
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

// Mock accounts for the demo login screen — no real backend, so signing
// in just matches (or creates) one of these locally. The two "quick
// login" shortcuts point at these exact records.
export const users = [
  {
    id: "u1",
    name: "Alex Morgan",
    email: "alex@example.com",
    role: "buyer",
    phone: "(555) 019-2231",
    referralCode: "ALEX4471",
    credits: 0,
  },
  {
    id: "u2",
    name: "Dana K.",
    email: "dana@riversiderapid.com",
    role: "owner",
    phone: "(555) 044-8871",
    referralCode: "DANA8820",
    credits: 0,
  },
];

export const REFERRAL_BONUS = 10;

// Concept-only: a browsable design catalog, standing in for what a real
// partnership with a model-sharing platform (à la MakerWorld) could feed
// into the app. Names, designers, and images here are entirely invented
// placeholders — not real listings or real designers — so this reads
// honestly as a mockup rather than an actual integration.
export const featuredDesigns = [
  {
    id: "d1",
    name: "Articulated Fox",
    category: "Toys & Props",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#8A5A44", 4),
    defaultMaterial: "PLA",
    estimatedGrams: 45,
    description:
      "Print-in-place articulated toy — no supports, no assembly. Joints are printed fully connected and move right off the plate.",
  },
  {
    id: "d2",
    name: "Modular Desk Organizer",
    category: "Home & Office",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#3E6B8A", 2),
    defaultMaterial: "PETG",
    estimatedGrams: 120,
    description: "Stackable trays that click together in any layout — pen holder, phone slot, and catch-all bin.",
  },
  {
    id: "d3",
    name: "Cable Clip 5-Pack",
    category: "Home & Office",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#5A7A3E", 6),
    defaultMaterial: "PLA",
    estimatedGrams: 18,
    description: "Adhesive-back cable clips in five widths, for desk and wall cable management.",
  },
  {
    id: "d4",
    name: "Articulating Phone Stand",
    category: "Home & Office",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#7A4A8A", 3),
    defaultMaterial: "PETG",
    estimatedGrams: 65,
    description: "Adjustable-angle stand with a friction hinge — holds phones and small tablets in portrait or landscape.",
  },
  {
    id: "d5",
    name: "Geometric Planter Set",
    category: "Home & Garden",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#4A8A5E", 5),
    defaultMaterial: "PLA",
    estimatedGrams: 90,
    description: "Faceted low-poly planters in three sizes, with a drainage layer built into the base.",
  },
  {
    id: "d6",
    name: "Voronoi Vase",
    category: "Decor",
    designer: "Community Maker",
    license: "Free · personal use",
    imageUrl: portfolioImage("#B4562B", 7),
    defaultMaterial: "PLA",
    estimatedGrams: 110,
    description: "Vase-mode single-wall print with an organic voronoi lattice pattern — lights up nicely with an LED tealight.",
  },
];

export const savedAddresses = [
  { id: "addr1", label: "Home", line: "482 Birchwood Ave, Springfield, IL 62704" },
  { id: "addr2", label: "Work", line: "110 E Monroe St, Suite 300, Springfield, IL 62701" },
];

export const savedPaymentMethods = [
  { id: "visa", label: "Visa •••• 4242" },
  { id: "wallet", label: "Poly POD Wallet ($42.10)" },
];
