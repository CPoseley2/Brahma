import test from "node:test";
import assert from "node:assert/strict";
import { budgetCategorySummary, budgetSummary, compareScenarioBudgets, divisionCostAllocation, registrationRevenueEstimate, registrationScenarioPresets, scenarioCostEstimate } from "../src/admin/budget-domain.js";

test("budget summary separates revenue, expenses, and projected surplus", () => {
  const items = [
    { type: "Revenue", category: "Registration", planned: 1000, committed: 900, actual: 700 },
    { type: "Expense", category: "Fields", planned: 700, committed: 600, actual: 450 },
  ];
  assert.deepEqual(budgetSummary(items), {
    plannedRevenue: 1000, plannedExpense: 700, committedRevenue: 900, committedExpense: 600,
    actualRevenue: 700, actualExpense: 450, forecastRevenue: 900, forecastExpense: 600,
    plannedSurplus: 300, projectedSurplus: 300, expenseUtilization: 86,
  });
  assert.equal(budgetCategorySummary(items).find(item => item.type === "Expense").variance, 100);
});

test("scenario cost estimate accounts for permits, recurring lights, and closures", () => {
  const scenario = { seasonStart: "2026-08-03", seasonEnd: "2026-08-30", blackoutDates: [], closedFieldIds: ["south"], practices: [{ fieldId: "north", date: "2026-08-03", time: "18:00", status: "Scheduled" }] };
  const estimate = scenarioCostEstimate(scenario, [{ id: "north", lights: true }, { id: "south", lights: false }]);
  assert.equal(estimate.weekCount, 4);
  assert.equal(estimate.permitCost, 2100);
  assert.equal(estimate.lightingCost, 48);
  assert.equal(estimate.contingencyCost, 1250);
  assert.equal(estimate.total, 3398);
});

test("scenario comparison replaces the facility forecast and measures against published", () => {
  const fields = [{ id: "north", lights: false }, { id: "south", lights: false }];
  const base = { seasonStart: "2026-08-03", seasonEnd: "2026-08-30", blackoutDates: [], closedFieldIds: [], practices: [{ fieldId: "north", date: "2026-08-03", time: "17:00", status: "Scheduled" }] };
  const scenarios = [{ ...base, id: "live", status: "published" }, { ...base, id: "draft", status: "draft", practices: [...base.practices, { fieldId: "south", date: "2026-08-04", time: "17:00", status: "Scheduled" }] }];
  const budgetItems = [{ type: "Revenue", category: "Registration", committed: 10000 }, { type: "Expense", category: "Fields & facilities", committed: 5000 }, { type: "Expense", category: "Equipment", committed: 1000 }];
  const result = compareScenarioBudgets(scenarios, fields, budgetItems);
  assert.equal(result[0].projectedSurplus, 6900);
  assert.equal(result[0].deltaFromPublished, 0);
  assert.equal(result[1].projectedSurplus, 4800);
  assert.equal(result[1].deltaFromPublished, -2100);
});

test("registration revenue applies the club add-on and progressive late fees", () => {
  const estimate = registrationRevenueEstimate({ baseFee: 165, clubAddOn: 12, lateFeeOne: 25, lateFeeTwo: 50, onTimePlayers: 7, lateOnePlayers: 2, lateTwoPlayers: 1 }, 10);
  assert.equal(estimate.onTimePrice, 177);
  assert.equal(estimate.lateOnePrice, 202);
  assert.equal(estimate.lateTwoPrice, 227);
  assert.equal(estimate.total, 1870);
  assert.equal(estimate.rosterDifference, 0);
});

test("registration policy scenarios prove the coach waiver against 1,200 players", () => {
  const scenarios = registrationScenarioPresets({ baseFee: 165, clubAddOn: 12, lateFeeOne: 25, lateFeeTwo: 50 }, 1200, 100);
  assert.deepEqual(scenarios.map(item => item.estimate.total), [212400, 217400, 227400, 194700]);
  assert.equal(scenarios[3].estimate.coachWaiverValue, 17700);
  assert.equal(scenarios[3].estimate.settings.coachPolicy, "waived");
});

test("division costs disclose player-share allocations", () => {
  const items = [
    { id: "budget-field-permits", type: "Expense", category: "Fields & facilities", committed: 900 },
    { id: "budget-uniforms", type: "Expense", category: "Uniforms", committed: 300 },
  ];
  const teams = [{ id: "six", division: "U6" }, { id: "eight", division: "U8" }, { id: "ten", division: "U10" }];
  const players = [{ teamId: "six" }, { teamId: "eight" }, { teamId: "eight" }, { teamId: "ten" }];
  const costs = divisionCostAllocation(items, players, teams); const permits = costs.find(item => item.name === "Permits"); const uniforms = costs.find(item => item.name === "Uniforms");
  assert.equal(permits.allocated.U6, 225);
  assert.equal(permits.allocated.U8, 450);
  assert.equal(uniforms.perPlayer, 75);
});
