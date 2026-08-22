import { seasonWeeks, timeToMinutes } from "./admin-domain.js";

export const BUDGET_TYPES = ["Revenue", "Expense"];
export const BUDGET_CATEGORIES = [
  "Registration", "Sponsorships", "Programs", "Fields & facilities", "Uniforms", "Game operations",
  "Equipment", "Insurance & compliance", "Scholarships", "Coach development", "Administration", "Contingency",
];

const amount = value => Math.max(0, Number(value) || 0);
const total = (items, key) => items.reduce((sum, item) => sum + amount(item[key]), 0);
const forecast = item => Math.max(amount(item.committed), amount(item.actual));

export function defaultRegistrationPlan(playerCount = 0) {
  const totalPlayers = Math.max(0, Math.round(Number(playerCount) || 0));
  return { baseFee: 165, clubAddOn: 12, lateFeeOne: 25, lateFeeTwo: 50, onTimePlayers: totalPlayers, lateOnePlayers: 0, lateTwoPlayers: 0, coachWaivers: 0, coachPolicy: "none" };
}

export function registrationRevenueEstimate(settings = {}, rosterCount = 0) {
  const baseFee = amount(settings.baseFee); const clubAddOn = amount(settings.clubAddOn); const lateFeeOne = amount(settings.lateFeeOne); const lateFeeTwo = amount(settings.lateFeeTwo);
  const onTimePlayers = Math.round(amount(settings.onTimePlayers)); const lateOnePlayers = Math.round(amount(settings.lateOnePlayers)); const lateTwoPlayers = Math.round(amount(settings.lateTwoPlayers));
  const coachWaivers = Math.round(amount(settings.coachWaivers)); const coachPolicy = ["waived", "held"].includes(settings.coachPolicy) ? settings.coachPolicy : "none";
  const onTimePrice = baseFee + clubAddOn; const lateOnePrice = onTimePrice + lateFeeOne; const lateTwoPrice = onTimePrice + lateFeeTwo;
  const assignedPlayers = onTimePlayers + lateOnePlayers + lateTwoPlayers; const activePlayers = Math.max(0, Math.round(Number(rosterCount) || 0));
  const grossTotal = onTimePlayers * onTimePrice + lateOnePlayers * lateOnePrice + lateTwoPlayers * lateTwoPrice; const waivedRegistrations = coachPolicy === "none" ? 0 : Math.min(coachWaivers, onTimePlayers); const coachWaiverValue = waivedRegistrations * onTimePrice;
  return {
    settings: { baseFee, clubAddOn, lateFeeOne, lateFeeTwo, onTimePlayers, lateOnePlayers, lateTwoPlayers, coachWaivers, coachPolicy },
    onTimePrice, lateOnePrice, lateTwoPrice, assignedPlayers, activePlayers, rosterDifference: assignedPlayers - activePlayers,
    grossTotal, waivedRegistrations, coachWaiverValue, total: grossTotal - coachWaiverValue,
  };
}

export function registrationScenarioPresets(settings = {}, rosterCount = 1200, teamCount = 100) {
  const prices = { baseFee: amount(settings.baseFee), clubAddOn: amount(settings.clubAddOn), lateFeeOne: amount(settings.lateFeeOne), lateFeeTwo: amount(settings.lateFeeTwo) };
  const players = Math.max(0, Math.round(Number(rosterCount) || 0)); const coaches = Math.min(players, Math.max(0, Math.round(Number(teamCount) || 0)));
  const values = [
    { id: "s1", label: "S1", name: "Flat registration", description: `${players} players pay the same price`, settings: { ...prices, onTimePlayers: players, lateOnePlayers: 0, lateTwoPlayers: 0, coachWaivers: 0, coachPolicy: "none" } },
    { id: "s2", label: "S2", name: "One late fee", description: "1,000 on time · 200 late 1", settings: { ...prices, onTimePlayers: Math.max(0, players - 200), lateOnePlayers: Math.min(200, players), lateTwoPlayers: 0, coachWaivers: 0, coachPolicy: "none" } },
    { id: "s3", label: "S3", name: "Two late fees", description: "800 on time · 200 late 1 · 200 late 2", settings: { ...prices, onTimePlayers: Math.max(0, players - 400), lateOnePlayers: Math.min(200, players), lateTwoPlayers: Math.min(200, Math.max(0, players - 200)), coachWaivers: 0, coachPolicy: "none" } },
    { id: "s4", label: "S4", name: "Flat fee + coach waiver", description: `${coaches} coach-family registrations waived`, settings: { ...prices, lateFeeOne: 0, lateFeeTwo: 0, onTimePlayers: players, lateOnePlayers: 0, lateTwoPlayers: 0, coachWaivers: coaches, coachPolicy: "waived" } },
  ];
  return values.map(value => ({ ...value, estimate: registrationRevenueEstimate(value.settings, players) }));
}

const TRANSPARENT_COSTS = [
  ["Equipment", item => item.category === "Equipment"],
  ["Permits", item => item.id === "budget-field-permits" || /field permit/i.test(item.name || "")],
  ["Referees", item => item.category === "Game operations"],
  ["Insurance", item => item.category === "Insurance & compliance"],
  ["Uniforms", item => item.category === "Uniforms"],
];

export function divisionCostAllocation(items = [], players = [], teams = [], divisions = ["U6", "U8"]) {
  const divisionByTeam = new Map(teams.map(team => [team.id, team.division])); const activePlayers = players.filter(player => player.active !== false); const totalPlayers = activePlayers.length;
  const counts = Object.fromEntries(divisions.map(division => [division, activePlayers.filter(player => divisionByTeam.get(player.teamId) === division).length]));
  return TRANSPARENT_COSTS.map(([name, matches]) => {
    const clubForecast = items.filter(item => item.type === "Expense" && matches(item)).reduce((sum, item) => sum + forecast(item), 0);
    const allocated = Object.fromEntries(divisions.map(division => [division, totalPlayers ? clubForecast * counts[division] / totalPlayers : 0]));
    return { name, clubForecast, perPlayer: totalPlayers ? clubForecast / totalPlayers : 0, allocated, playerCounts: counts, totalPlayers };
  });
}

export function budgetSummary(items = []) {
  const revenue = items.filter(item => item.type === "Revenue"); const expenses = items.filter(item => item.type === "Expense");
  const plannedRevenue = total(revenue, "planned"); const plannedExpense = total(expenses, "planned");
  const committedRevenue = total(revenue, "committed"); const committedExpense = total(expenses, "committed");
  const actualRevenue = total(revenue, "actual"); const actualExpense = total(expenses, "actual");
  const forecastRevenue = revenue.reduce((sum, item) => sum + forecast(item), 0); const forecastExpense = expenses.reduce((sum, item) => sum + forecast(item), 0);
  return {
    plannedRevenue, plannedExpense, committedRevenue, committedExpense, actualRevenue, actualExpense, forecastRevenue, forecastExpense,
    plannedSurplus: plannedRevenue - plannedExpense, projectedSurplus: forecastRevenue - forecastExpense,
    expenseUtilization: plannedExpense ? Math.round(forecastExpense / plannedExpense * 100) : 0,
  };
}

export function budgetCategorySummary(items = []) {
  const values = new Map();
  items.forEach(item => {
    const key = `${item.type}|${item.category}`; const current = values.get(key) || { type: item.type, category: item.category, planned: 0, committed: 0, actual: 0, forecast: 0 };
    current.planned += amount(item.planned); current.committed += amount(item.committed); current.actual += amount(item.actual); current.forecast += forecast(item); values.set(key, current);
  });
  return [...values.values()].map(item => ({ ...item, variance: item.type === "Expense" ? item.planned - item.forecast : item.forecast - item.planned })).sort((a, b) => b.planned - a.planned);
}

export function scenarioCostEstimate(scenario, fields = []) {
  if (!scenario) return { permitCost: 0, lightingCost: 0, contingencyCost: 0, total: 0, activeFieldCount: 0, latePatterns: 0, weekCount: 0 };
  const fieldById = new Map(fields.map(field => [field.id, field])); const activePractices = (scenario.practices || []).filter(item => item.status !== "Canceled");
  const activeFieldIds = new Set(activePractices.map(item => item.fieldId).filter(Boolean));
  const latePatterns = activePractices.filter(item => timeToMinutes(item.time) >= 18 * 60 && fieldById.get(item.fieldId)?.lights).length;
  const weekCount = seasonWeeks(scenario.seasonStart, scenario.seasonEnd, scenario.blackoutDates).length;
  const permitCost = activeFieldIds.size * 2100; const lightingCost = latePatterns * weekCount * 12; const contingencyCost = (scenario.closedFieldIds || []).length * 1250;
  return { permitCost, lightingCost, contingencyCost, total: permitCost + lightingCost + contingencyCost, activeFieldCount: activeFieldIds.size, latePatterns, weekCount };
}

export function compareScenarioBudgets(scenarios = [], fields = [], budgetItems = []) {
  const summary = budgetSummary(budgetItems);
  const facilityForecast = budgetItems.filter(item => item.type === "Expense" && item.category === "Fields & facilities").reduce((sum, item) => sum + forecast(item), 0);
  const comparisons = scenarios.map(scenario => {
    const estimate = scenarioCostEstimate(scenario, fields); const projectedExpense = summary.forecastExpense - facilityForecast + estimate.total;
    return { scenario, estimate, projectedExpense, projectedSurplus: summary.forecastRevenue - projectedExpense };
  });
  const published = comparisons.find(item => item.scenario.status === "published") || comparisons[0];
  return comparisons.map(item => ({ ...item, deltaFromPublished: item.projectedSurplus - (published?.projectedSurplus || 0) }));
}
