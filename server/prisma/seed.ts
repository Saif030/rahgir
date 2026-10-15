// EventRoute rich demo seed.
// 15 venues · ~110 events (past + 14 days future, incl. full / cancelled / moved)
// 6 users · ~30 registrations · 3 demo itineraries (one with conflicts) · crowd time-series.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CATEGORIES = ["Tech", "Design", "Business", "Networking", "Wellness"] as const;
const CENTER = { lat: 12.9716, lng: 77.5946 };

const VENUES: { name: string; building: string; dLat: number; dLng: number; capacity: number; amenities: string[]; eateryNearby: boolean }[] = [
  { name: "Main Auditorium", building: "A-Block", dLat: 0, dLng: 0, capacity: 800, amenities: ["AC", "Stage", "Cafeteria"], eateryNearby: true },
  { name: "Innovation Lab", building: "B-Block", dLat: 0.0012, dLng: 0.0008, capacity: 120, amenities: ["3D Printer", "WiFi"], eateryNearby: false },
  { name: "Design Studio", building: "C-Block", dLat: -0.0009, dLng: 0.0011, capacity: 80, amenities: ["Mac Lab", "Crit Wall"], eateryNearby: false },
  { name: "Business Hall", building: "D-Block", dLat: 0.0021, dLng: -0.0006, capacity: 300, amenities: ["Projector"], eateryNearby: true },
  { name: "Wellness Center", building: "E-Block", dLat: -0.0018, dLng: -0.0012, capacity: 150, amenities: ["Yoga Mats"], eateryNearby: false },
  { name: "Open Air Theatre", building: "Amphitheatre", dLat: 0.0028, dLng: 0.0019, capacity: 1000, amenities: ["Stage", "Food Stalls"], eateryNearby: true },
  { name: "Seminar Hall 1", building: "A-Block", dLat: 0.0003, dLng: 0.0002, capacity: 200, amenities: ["AC"], eateryNearby: true },
  { name: "Seminar Hall 2", building: "B-Block", dLat: 0.0015, dLng: 0.001, capacity: 180, amenities: ["AC"], eateryNearby: false },
  { name: "Cafeteria Plaza", building: "Food Court", dLat: -0.0004, dLng: -0.0005, capacity: 400, amenities: ["Food", "Seating"], eateryNearby: true },
  { name: "Library Hall", building: "Library", dLat: 0.0008, dLng: -0.0015, capacity: 250, amenities: ["Quiet", "WiFi"], eateryNearby: false },
  { name: "Sports Complex", building: "Sports", dLat: -0.0028, dLng: 0.0022, capacity: 500, amenities: ["Ground", "First Aid"], eateryNearby: true },
  { name: "Networking Lounge", building: "D-Block", dLat: 0.0023, dLng: -0.0009, capacity: 100, amenities: ["Coffee", "WiFi"], eateryNearby: true },
  { name: "Tech Park Stage", building: "Outdoor", dLat: 0.0035, dLng: 0.0005, capacity: 600, amenities: ["Stage"], eateryNearby: false },
  { name: "Meditation Garden", building: "Garden", dLat: -0.0032, dLng: -0.0008, capacity: 60, amenities: ["Garden"], eateryNearby: false },
  { name: "Incubation Hub", building: "F-Block", dLat: 0.0018, dLng: -0.0022, capacity: 90, amenities: ["Mentor Rooms"], eateryNearby: false },
];

const TITLES: Record<string, string[]> = {
  Tech: ["AI Hackathon Kickoff", "Cloud Native Workshop", "Robotics Demo Day", "Intro to LLMs", "Cybersecurity 101", "Web3 Builders Meet", "Data Science Bootcamp", "IoT Hands-on Lab", "DevOps Crash Course", "Quantum Computing Talk", "Mobile App Sprint", "Rust Study Group"],
  Design: ["UI Systems Masterclass", "Design Thinking Jam", "Typography Walkthrough", "Figma Prototyping Lab", "Portfolio Review Night", "Motion Design Basics", "Color Theory Workshop", "UX Research Fieldwork", "Brand Sprint", "Poster Design Battle", "3D Modeling Intro", "Design Crit Circle"],
  Business: ["Startup Pitch Night", "VC Funding Panel", "Marketing Growth Hacks", "Finance for Founders", "Case Competition", "Product-Market Fit Talk", "Negotiation Workshop", "E-commerce Playbook", "Leadership Roundtable", "IPO Readiness 101", "Sales Bootcamp", "Founder AMA"],
  Networking: ["Alumni Mixer", "Founder Speed-Dating", "Tech Meet & Greet", "Women in Tech Circle", "Open Mic & Mingle", "Career Fair Afterparty", "Mentor Matchmaking", "Community Brunch", "Startup Crawl", "Evening Social", "Coffee with CXOs", "Hack Night Mixer"],
  Wellness: ["Sunrise Yoga", "Mindfulness Meditation", "5K Fun Run", "Nutrition Basics", "Stress Management", "Zumba Evening", "Sleep Hygiene Talk", "Nature Walk", "Breathwork Session", "First-Aid Essentials", "Desk Ergonomics", "Guided Journaling"],
};

const SPEAKERS = [
  ["Dr. Ananya Rao", "AI researcher, ex-ISRO, 12 yrs in ML systems."],
  ["Karthik Menon", "Staff designer, 10 yrs building design systems."],
  ["Meera Iyer", "VC partner, 40+ seed investments."],
  ["Arjun Shetty", "Founder of 2 startups, community builder."],
  ["Divya Nair", "Certified yoga & mindfulness coach."],
  ["Rohan Verma", "Cloud architect, CNCF ambassador."],
  ["Sana Khan", "UX lead, design educator."],
  ["Vikram Patel", "Fintech CFO, startup advisor."],
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  console.log("[seed] clearing...");
  await prisma.itineraryItem.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.crowdSample.deleteMany();
  await prisma.routeCache.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const [attendee, organiser, admin, priya, rahul, org2] = await Promise.all([
    prisma.user.create({ data: { name: "Demo Attendee", email: "attendee@test.com", passwordHash, role: "ATTENDEE", interests: JSON.stringify(["Tech", "Networking"]), favoriteCategories: JSON.stringify(["Tech", "Networking"]) } }),
    prisma.user.create({ data: { name: "Demo Organiser", email: "organiser@test.com", passwordHash, role: "ORGANISER", interests: JSON.stringify(["Business"]), favoriteCategories: JSON.stringify(["Business", "Tech"]) } }),
    prisma.user.create({ data: { name: "Admin", email: "admin@test.com", passwordHash, role: "ADMIN", interests: JSON.stringify([]), favoriteCategories: JSON.stringify([]) } }),
    prisma.user.create({ data: { name: "Priya Sharma", email: "priya@test.com", passwordHash, role: "ATTENDEE", interests: JSON.stringify(["Design", "Wellness"]), favoriteCategories: JSON.stringify(["Design", "Wellness"]) } }),
    prisma.user.create({ data: { name: "Rahul Gupta", email: "rahul@test.com", passwordHash, role: "ATTENDEE", interests: JSON.stringify(["Business", "Tech"]), favoriteCategories: JSON.stringify(["Business"]) } }),
    prisma.user.create({ data: { name: "Wellness Org", email: "wellness-org@test.com", passwordHash, role: "ORGANISER", interests: JSON.stringify(["Wellness"]), favoriteCategories: JSON.stringify(["Wellness"]) } }),
  ]);
  console.log("[seed] users: 6");

  const venues = [];
  for (const v of VENUES) {
    venues.push(
      await prisma.venue.create({
        data: {
          name: v.name, building: v.building,
          lat: CENTER.lat + v.dLat, lng: CENTER.lng + v.dLng,
          capacity: v.capacity, amenities: JSON.stringify(v.amenities), eateryNearby: v.eateryNearby,
        },
      }),
    );
  }
  console.log(`[seed] venues: ${venues.length}`);

  const now = new Date();
  const mkDate = (dayOffset: number, hour: number, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, min, 0, 0);
    return d;
  };

  let n = 0;
  const allEvents: { id: string; startsAt: Date; endsAt: Date; category: string; title: string }[] = [];

  async function createEvent(day: number, slot: number, i: number, past: boolean) {
    const cat = CATEGORIES[(Math.abs(day) + slot + i) % CATEGORIES.length];
    const title = `${pick(TITLES[cat], Math.abs(day) * 3 + slot + i)}${past ? " (Past)" : ` — Day ${day + 1}`}`;
    const venue = venues[(Math.abs(day) * 5 + slot * 2 + i) % venues.length];
    const start = mkDate(day, 9 + slot);
    const durMin = [45, 60, 90, 120][i % 4];
    const end = new Date(start.getTime() + durMin * 60000);
    const capacity = 30 + ((i * 37) % 300);
    // Mix of availability: every 5th full, every 7th almost-full, else partial
    const fill = i % 5 === 4 ? 1 : i % 7 === 6 ? 0.9 : ((i * 13) % 70) / 100;
    const status = !past && i % 13 === 12 ? "CANCELLED" : !past && i % 17 === 16 ? "MOVED" : "SCHEDULED";
    const [spName, spBio] = SPEAKERS[i % SPEAKERS.length];
    const e = await prisma.event.create({
      data: {
        title, description: `${title} (${cat}). Hands-on session with Q&A, materials included. Arrive 10 min early!`,
        category: cat, venueId: venue.id, startsAt: start, endsAt: end,
        capacity, registeredCount: Math.floor(capacity * fill),
        difficulty: ["Beginner", "Intermediate", "Advanced"][i % 3],
        speakerName: spName, speakerBio: spBio,
        planOut: JSON.stringify({ setupMin: 15, bufferMin: 15, teardownMin: 10 }),
        status, createdById: cat === "Wellness" ? org2.id : organiser.id,
      },
    });
    n++;
    allEvents.push({ id: e.id, startsAt: start, endsAt: end, category: cat, title });
    return e;
  }

  // Past events (attendance history): 2 days × 6
  const pastEvents = [];
  for (let day = -2; day <= -1; day++) {
    for (let slot = 0; slot < 6; slot++) pastEvents.push(await createEvent(day, slot, n, true));
  }
  // Future events: 14 days × 7 slots (skip late slots some days for realism)
  const futureEvents = [];
  for (let day = 0; day < 14; day++) {
    const slots = day % 3 === 2 ? 5 : 7;
    for (let slot = 0; slot < slots; slot++) futureEvents.push(await createEvent(day, slot, n, false));
  }
  console.log(`[seed] events: ${n} (${pastEvents.length} past, ${futureEvents.length} future)`);

  // Registrations — attendance history (past) + upcoming interests
  let regCount = 0;
  async function reg(userId: string, eventId: string, docs: string[] = []) {
    await prisma.registration.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, documentsUrl: JSON.stringify(docs), autoFilled: JSON.stringify({ oneClick: true }) },
      update: {},
    });
    regCount++;
  }
  // Attendee: 8 past (history) + 6 upcoming
  for (let k = 0; k < 8; k++) await reg(attendee.id, pastEvents[(k * 2) % pastEvents.length].id, k % 3 === 0 ? ["id-card.pdf"] : []);
  for (let k = 0; k < 6; k++) await reg(attendee.id, futureEvents[(k * 5 + 1) % futureEvents.length].id);
  // Priya: design/wellness-flavoured
  const priyaPicks = futureEvents.filter((e) => e.category === "Design" || e.category === "Wellness").slice(0, 5);
  for (const e of priyaPicks) await reg(priya.id, e.id);
  for (let k = 0; k < 3; k++) await reg(priya.id, pastEvents[k].id);
  // Rahul: business-flavoured
  const rahulPicks = futureEvents.filter((e) => e.category === "Business" || e.category === "Tech").slice(0, 5);
  for (const e of rahulPicks) await reg(rahul.id, e.id);
  // Sync registeredCount with reality
  for (const e of [...pastEvents, ...futureEvents]) {
    const c = await prisma.registration.count({ where: { eventId: e.id } });
    const base = Math.floor(e.capacity * 0.4);
    await prisma.event.update({ where: { id: e.id }, data: { registeredCount: Math.min(e.capacity, base + c * 3) } });
  }
  // Force a couple of truly-full + almost-full showcases
  const fullDemo = futureEvents.filter((e) => e.status === "SCHEDULED").slice(0, 2);
  for (const e of fullDemo) await prisma.event.update({ where: { id: e.id }, data: { registeredCount: e.capacity } });
  console.log(`[seed] registrations: ${regCount}`);

  // Demo itineraries for attendee@test.com
  const day1 = futureEvents.filter((e) => e.startsAt.getDate() === mkDate(1, 9).getDate() && e.status === "SCHEDULED").slice(0, 3);
  const fri = await prisma.itinerary.create({ data: { userId: attendee.id, name: "Friday Schedule" } });
  for (let k = 0; k < day1.length; k++) {
    await prisma.itineraryItem.create({ data: { itineraryId: fri.id, eventId: day1[k].id, order: k } });
  }
  // Itinerary with an intentional overlap (conflict demo): two events same morning
  const overlap = futureEvents.filter((e) => e.status === "SCHEDULED").slice(10, 12);
  const sat = await prisma.itinerary.create({ data: { userId: attendee.id, name: "Saturday Sprint" } });
  for (let k = 0; k < overlap.length; k++) {
    await prisma.itineraryItem.create({ data: { itineraryId: sat.id, eventId: overlap[k].id, order: k } });
  }
  const well = futureEvents.filter((e) => e.category === "Wellness" && e.status === "SCHEDULED").slice(0, 4);
  const wIt = await prisma.itinerary.create({ data: { userId: priya.id, name: "Wellness Weekend" } });
  for (let k = 0; k < well.length; k++) {
    await prisma.itineraryItem.create({ data: { itineraryId: wIt.id, eventId: well[k].id, order: k } });
  }
  console.log("[seed] itineraries: 3 (Friday Schedule, Saturday Sprint w/ conflict, Wellness Weekend)");

  // Crowd time-series: 4 samples per venue over last 2h (heatmap history + live)
  for (const v of venues) {
    const base = 0.2 + ((venues.indexOf(v) * 37) % 60) / 100;
    for (let h = 0; h < 4; h++) {
      await prisma.crowdSample.create({
        data: {
          venueId: v.id,
          density: Math.min(1, Math.max(0.05, base + Math.sin(h + venues.indexOf(v)) * 0.15)),
          ts: new Date(Date.now() - h * 30 * 60000),
        },
      });
    }
  }
  console.log("[seed] crowd samples: 60 (4 per venue)");

  // Popular route pairs (haversine distance pre-seed; road geometry is fetched
  // live from Mapbox/OSRM on first request — geometry stays empty until then)
  const R = 6371000;
  const hav = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLa = ((b.lat - a.lat) * Math.PI) / 180;
    const dLn = ((b.lng - a.lng) * Math.PI) / 180;
    const s = Math.sin(dLa / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const pairs: [number, number][] = [[0, 1], [0, 6], [6, 8], [3, 11], [0, 5], [8, 10], [1, 14]];
  for (const [a, b] of pairs) {
    const d = hav(venues[a], venues[b]);
    await prisma.routeCache.upsert({
      where: { fromVenueId_toVenueId_mode: { fromVenueId: venues[a].id, toVenueId: venues[b].id, mode: "walking" } },
      create: { fromVenueId: venues[a].id, toVenueId: venues[b].id, mode: "walking", durationSec: (d / 80) * 60, distanceM: d, geometry: "" },
      update: { durationSec: (d / 80) * 60, distanceM: d },
    });
  }
  console.log("[seed] done. Logins (Password123!): attendee / priya / rahul / organiser / wellness-org / admin (@test.com)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
