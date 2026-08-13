import { addDays, PRACTICE_START_TIMES, practicesOverlap, startOfWeek } from "./admin-domain.js";

const FIELD_SEEDS = [
  ["fair-oaks-north", "Fair Oaks Park · North", "Fair Oaks Park", "11549 Fair Oaks Blvd"],
  ["fair-oaks-south", "Fair Oaks Park · South", "Fair Oaks Park", "11549 Fair Oaks Blvd"],
  ["miller-east", "Miller Park · East", "Miller Park", "8480 Sunset Ave"],
  ["miller-west", "Miller Park · West", "Miller Park", "8480 Sunset Ave"],
  ["williamson-a", "Williamson Park · A", "Williamson Park", "10499 Fair Oaks Blvd"],
  ["williamson-b", "Williamson Park · B", "Williamson Park", "10499 Fair Oaks Blvd"],
  ["madera-upper", "Madera Park · Upper", "Madera Park", "1000 Madera Ave"],
  ["madera-lower", "Madera Park · Lower", "Madera Park", "1000 Madera Ave"],
  ["twin-lakes-main", "Twin Lakes Elementary · Main", "Twin Lakes Elementary", "5515 Main Ave"],
  ["twin-lakes-small", "Twin Lakes Elementary · Small", "Twin Lakes Elementary", "5515 Main Ave"],
  ["patriot-stadium", "Patriot Park · Stadium", "Patriot Park", "6827 Palm Ave"],
  ["patriot-training", "Patriot Park · Training", "Patriot Park", "6827 Palm Ave"],
  ["orangevale-a", "Orangevale Community · A", "Orangevale Community Park", "7301 Filbert Ave"],
  ["orangevale-b", "Orangevale Community · B", "Orangevale Community Park", "7301 Filbert Ave"],
  ["pershing-north", "Pershing Elementary · North", "Pershing Elementary", "9010 Pershing Ave"],
  ["pershing-south", "Pershing Elementary · South", "Pershing Elementary", "9010 Pershing Ave"],
  ["del-campo-main", "Del Campo · Main", "Del Campo High School", "4925 Dewey Dr"],
  ["del-campo-practice", "Del Campo · Practice", "Del Campo High School", "4925 Dewey Dr"],
  ["phoenix-east", "Phoenix Park · East", "Phoenix Park", "9050 Sunset Ave"],
  ["phoenix-west", "Phoenix Park · West", "Phoenix Park", "9050 Sunset Ave"],
];

const DIVISIONS = ["U6", "U7", "U8", "U9", "U10", "U11", "U12", "U14"];
const MASCOTS = ["Jaguars", "Fireflies", "Comets", "Foxes", "Ravens", "Orcas", "Strikers", "Sparks", "Bolts", "Falcons", "United", "Gold", "Otters", "Coyotes", "Dragons", "Hawks", "Lynx", "Pumas", "Stingrays", "Thunder"];
const COLORS = ["Blue", "Gold", "White", "Navy", "Silver"];
const FIRST_NAMES = ["Avery", "Maya", "Theo", "Liam", "Sofia", "Nora", "Mateo", "Eli", "Zoe", "Mila", "Caleb", "Riley"];
const LAST_NAMES = ["Garcia", "Chen", "Johnson", "Patel", "Rivera", "Kim", "Thompson", "Nguyen", "Davis", "Martinez", "Brown", "Wilson"];
const COACH_FIRST = ["Jordan", "Sam", "Priya", "Marcus", "Elena", "Chris", "Taylor", "Devon", "Morgan", "Casey", "Alex", "Jamie", "Rene", "Drew", "Skyler"];
const COACH_LAST = ["Lee", "Rodriguez", "Shah", "Green", "Ruiz", "Walker", "Brooks", "King", "Bell", "Young"];
export function createBudgetItems() {
  return [
    ["registration-fees", "Revenue", "Registration", "Player registration fees", 165000, 158400, 142750, "Registrar"],
    ["club-sponsorships", "Revenue", "Sponsorships", "Club and team sponsorships", 25000, 21000, 18000, "Fundraising"],
    ["clinics-merchandise", "Revenue", "Programs", "Clinics and merchandise", 8000, 5200, 3600, "Programs"],
    ["field-permits", "Expense", "Fields & facilities", "School and park field permits", 52000, 48750, 33100, "Fields"],
    ["uniform-kits", "Expense", "Uniforms", "Player and goalkeeper kits", 38000, 36500, 34200, "Equipment"],
    ["referees-game-ops", "Expense", "Game operations", "Referees and match operations", 30000, 27600, 16400, "Competition"],
    ["training-equipment", "Expense", "Equipment", "Balls, goals, bags, pumps, first aid, and team supplies", 20000, 17000, 16674, "Equipment"],
    ["insurance-licenses", "Expense", "Insurance & compliance", "Insurance, affiliation, and permits", 18000, 18000, 18000, "Treasurer"],
    ["player-scholarships", "Expense", "Scholarships", "Registration assistance", 12000, 9300, 8400, "Registrar"],
    ["coach-development", "Expense", "Coach development", "Clearance, education, and licensing", 7500, 6200, 5100, "Coaching"],
    ["club-administration", "Expense", "Administration", "Technology, communications, and supplies", 9000, 7800, 5900, "Treasurer"],
    ["weather-reserve", "Expense", "Contingency", "Weather and replacement-field reserve", 10000, 2500, 0, "Fields"],
  ].map(([id, type, category, name, planned, committed, actual, owner]) => ({ id: `budget-${id}`, type, category, name, planned, committed, actual, owner, notes: "Fall 2026 operating plan.", updatedAt: new Date().toISOString() }));
}

export function createGearItems() {
  const amazon = query => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  return [
    ["balls", "Soccer balls", "Team kit", "Amazon", amazon("bulk size 4 soccer balls youth team"), "team", 2, 1, 17.99, 200, 200, 180, 3598],
    ["first-aid", "First aid kits", "Safety", "Amazon", amazon("sports team first aid kit bulk"), "team", 1, 1, 19.99, 100, 100, 90, 1999],
    ["pumps", "Ball pumps", "Team kit", "Amazon", amazon("soccer ball pump bulk pack"), "team", 1, 1, 8.99, 100, 98, 88, 899],
    ["ball-bags", "Ball bags", "Team kit", "Amazon", amazon("soccer ball bag team equipment"), "team", 1, 1, 21.99, 100, 100, 90, 2199],
    ["accuracy-goals", "Small-sided accuracy goals", "Training", "Amazon", amazon("small sided soccer accuracy goals set portable"), "team", 1, 1, 59.99, 100, 92, 84, 5999],
    ["stickers", "Custom club stickers", "Club identity", "Amazon", amazon("custom logo vinyl stickers bulk 1000"), "player", 1, 50, .40, 1200, 1200, 1160, 480],
    ["magnets", "Custom club magnets", "Club identity", "Amazon", amazon("custom logo magnets bulk"), "player", 1, 50, 1.25, 1200, 1200, 1140, 1500],
    ["jerseys", "Player jerseys", "Uniforms", "Soccer Post", "https://soccerpost.com/tools/locations/locations/fair-oaks-soccer-post", "player", 1, 1, 28.50, 1200, 1200, 1140, 34200],
  ].map(([key, name, category, vendor, sourceUrl, basis, rate, packSize, unitCost, orderedQty, receivedQty, distributedQty, actualSpend]) => ({
    id: `gear-${key}`, name, category, vendor, sourceUrl, basis, rate, packSize, unitCost, orderedQty, receivedQty, distributedQty, actualSpend,
    status: distributedQty >= orderedQty ? "Complete" : receivedQty >= orderedQty ? "Distributing" : "Receiving", notes: "Prior-season record; verify the live vendor price before ordering.", updatedAt: new Date().toISOString(),
  }));
}

export function createGearDistributions(teams = []) {
  return teams.map((team, index) => ({
    id: `gear-delivery-${team.id}`, teamId: team.id, status: index < 78 ? "Picked up" : index < 84 ? "Ready" : "Needs items",
    balls: index < 92 ? 2 : index % 2, firstAid: index < 95, pump: index < 90, ballBag: index < 94, goals: index < 84,
    pickedUpBy: index < 78 ? `Coach ${index + 1}` : "", pickedUpAt: index < 78 ? addDays(startOfWeek(new Date()), index % 12) : "", notes: index >= 92 ? "Waiting on one or more team-kit items." : "",
  }));
}
export function createAdminDemoData() {
  const weekStart = startOfWeek(new Date());
  const fields = FIELD_SEEDS.map(([id, name, park, address], index) => ({
    id: `field-${id}`, name, park, address, status: index === 17 ? "Permit pending" : "Open", lights: index >= 10 || index % 4 === 0,
    notes: index === 17 ? "Final district permit confirmation expected this week." : "Standard youth field configuration.",
  }));
  const teams = Array.from({ length: 100 }, (_, index) => {
    const division = DIVISIONS[index % DIVISIONS.length];
    const mascot = MASCOTS[index % MASCOTS.length]; const color = COLORS[Math.floor(index / MASCOTS.length) % COLORS.length];
    return {
      id: `${division.toLowerCase()}-${mascot.toLowerCase()}-${color.toLowerCase()}-${index + 1}`, name: `${division} ${mascot} ${color}`,
      division, defaultFieldId: fields[(index * 7) % fields.length].id, practicePattern: "Two practices weekly", season: "Fall 2026",
      status: index >= 96 ? "Forming" : "Active", coachIds: index < 86 ? [`coach-${(index % 72) + 1}`] : [],
      philosophy: "Every child belongs and grows through play.",
    };
  });
  const players = teams.flatMap((team, teamIndex) => Array.from({ length: 12 }, (_, index) => ({
    id: `${team.id}-player-${index + 1}`, teamId: team.id, firstName: FIRST_NAMES[(teamIndex + index) % FIRST_NAMES.length],
    lastName: LAST_NAMES[(teamIndex * 2 + index) % LAST_NAMES.length], dateOfBirth: `${2020 - Math.min(7, Math.floor(teamIndex % 16 / 2))}-${String((index % 9) + 1).padStart(2, "0")}-12`,
    familyEmail: `parent${teamIndex + 1}-${index + 1}@example.com`, familyPhone: `(916) 555-${String(1200 + ((teamIndex * 11 + index) % 8000)).padStart(4, "0")}`, active: true,
  })));
  const coaches = Array.from({ length: 75 }, (_, index) => {
    const name = `${COACH_FIRST[index % COACH_FIRST.length]} ${COACH_LAST[Math.floor(index / COACH_FIRST.length) % COACH_LAST.length]}`;
    return {
      id: `coach-${index + 1}`, name, email: `${name.toLowerCase().replaceAll(" ", ".")}${index + 1}@example.com`, phone: `(916) 555-${String(4100 + index).padStart(4, "0")}`,
      clearanceStatus: index % 19 === 0 ? "Expired" : index % 13 === 0 ? "Pending" : index % 11 === 0 ? "Expiring soon" : "Cleared",
      clearanceExpires: addDays(weekStart, index % 11 === 0 ? 21 : 120 + index),
      assignments: teams.filter(team => team.coachIds.includes(`coach-${index + 1}`)).map((team, teamIndex) => ({ teamId: team.id, role: teamIndex === 0 ? "headCoach" : "assistantCoach" })),
    };
  });
  const practices = teams.flatMap((team, teamIndex) => [0, 1].map(sessionIndex => {
    const sequence = teamIndex * 2 + sessionIndex; const slot = (sequence * 37) % 700;
    const fieldIndex = Math.floor(slot / 35); const remainder = slot % 35; const dayIndex = Math.floor(remainder / 7); const timeIndex = remainder % 7;
    const field = fields[fieldIndex]; const date = addDays(weekStart, dayIndex); const time = PRACTICE_START_TIMES[timeIndex];
    return {
      id: `practice-${team.id}-${sessionIndex + 1}`, teamId: team.id, type: "Practice", opponent: "Team practice", date, time,
      durationMinutes: Number(team.division.slice(1)) >= 11 ? 90 : Number(team.division.slice(1)) >= 9 ? 75 : 60,
      fieldId: field.id, location: field.name, status: "Scheduled", notes: sessionIndex ? "Technical development and small-sided play." : "Team training and game preparation.",
    };
  }));
  const conflictSource = practices[24];
  const publishedPractices = practices.map(item => ({ ...item, adminManaged: true }));
  const importedDraft = publishedPractices.map(item => ({ ...item }));
  importedDraft.push({ ...conflictSource, id: "practice-demo-conflict", teamId: teams[88].id, time: conflictSource.time, notes: "Intentional import conflict for admin review.", adminManaged: true });
  const coachFriendly = [];
  publishedPractices.forEach((item, index) => {
    const team = teams.find(value => value.id === item.teamId); const younger = Number(team.division.slice(1)) <= 8; const occupied = [...coachFriendly, ...publishedPractices.slice(index + 1)];
    const earlier = younger && item.time >= "18:00" ? ["17:30", "17:00", "16:30", "16:00"].map(time => ({ ...item, time, notes: "Earlier start prioritized for younger players." })).find(candidate => !occupied.some(other => practicesOverlap(candidate, other))) : null;
    coachFriendly.push(earlier || { ...item });
  });
  const weatherClosed = fields.slice(0, 4).map(field => field.id);
  const weatherPractices = publishedPractices.filter(item => !weatherClosed.includes(item.fieldId)).map(item => ({ ...item }));
  const scenarios = [
    { id: "scenario-published", name: "Published season", description: "Current family-facing schedule.", kind: "Published plan", status: "published", seasonStart: weekStart, seasonEnd: addDays(weekStart, 83), blackoutDates: [addDays(weekStart, 35), addDays(weekStart, 70)], closedFieldIds: [], updatedAt: new Date().toISOString(), practices: publishedPractices },
    { id: "scenario-balanced", name: "Balanced capacity", description: "Even field utilization with every active team placed twice weekly.", kind: "Working draft", status: "draft", seasonStart: weekStart, seasonEnd: addDays(weekStart, 83), blackoutDates: [addDays(weekStart, 35), addDays(weekStart, 70)], closedFieldIds: [], updatedAt: new Date().toISOString(), practices: publishedPractices.map(item => ({ ...item })) },
    { id: "scenario-coach", name: "Coach preference", description: "Earlier starts for younger divisions and fewer late coach conflicts.", kind: "Working draft", status: "draft", seasonStart: weekStart, seasonEnd: addDays(weekStart, 83), blackoutDates: [addDays(weekStart, 35), addDays(weekStart, 70)], closedFieldIds: [], updatedAt: new Date().toISOString(), practices: coachFriendly },
    { id: "scenario-weather", name: "Heavy rain contingency", description: "Four grass fields unavailable; displaced teams await smart reallocation.", kind: "Weather contingency", status: "contingency", seasonStart: weekStart, seasonEnd: addDays(weekStart, 83), blackoutDates: [addDays(weekStart, 35), addDays(weekStart, 70)], closedFieldIds: weatherClosed, updatedAt: new Date().toISOString(), practices: weatherPractices },
    { id: "scenario-imported", name: "Registration import", description: "Fresh registrar export staged for validation and correction.", kind: "Imported draft", status: "draft", seasonStart: weekStart, seasonEnd: addDays(weekStart, 83), blackoutDates: [addDays(weekStart, 35), addDays(weekStart, 70)], closedFieldIds: [], updatedAt: new Date().toISOString(), practices: importedDraft },
  ];
  const gearItems = createGearItems(); const gearDistributions = createGearDistributions(teams);
  return {
    version: 5, club: { name: "Fair Oaks Soccer Club", season: "Fall 2026" }, teams, fields, coaches, players, practices: publishedPractices, scenarios, budgetItems: createBudgetItems(), gearItems, gearDistributions,
    broadcasts: [{ id: "welcome-admin", teamIds: teams.map(team => team.id), title: "Welcome to the fall season", body: "Schedules are live. Please confirm your team’s practice field in the app.", sentAt: new Date(Date.now() - 86400000).toISOString(), sentByLabel: "Club office" }],
  };
}
