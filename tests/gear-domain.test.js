import test from "node:test";
import assert from "node:assert/strict";
import { gearDistributionSummary, gearOrderSummary, gearPlan, normalizeGearPlayerCount, scaledGearBudget } from "../src/admin/gear-domain.js";

test("gear planning rounds player scenarios by 50 and derives team kits", () => {
  const items = [
    { id: "balls", basis: "team", rate: 2, packSize: 1, unitCost: 20, vendor: "Amazon" },
    { id: "stickers", basis: "player", rate: 1, packSize: 50, unitCost: .5, vendor: "Amazon" },
    { id: "jerseys", basis: "player", rate: 1, packSize: 1, unitCost: 30, vendor: "Soccer Post" },
  ];
  const plan = gearPlan(items, 1224, 12);
  assert.equal(normalizeGearPlayerCount(1224), 1200);
  assert.equal(plan.teamCount, 100);
  assert.deepEqual(plan.lines.map(item => item.quantity), [200, 1200, 1200]);
  assert.equal(plan.vendorTotals.Amazon, 4600);
  assert.equal(plan.vendorTotals["Soccer Post"], 36000);
});

test("gear summaries keep receipts and team handoff visible", () => {
  assert.deepEqual(gearOrderSummary([{ orderedQty: 100, receivedQty: 80, distributedQty: 60, actualSpend: 500 }]), { orderedSpend: 500, ordered: 100, received: 80, distributed: 60, receivedPercent: 80, distributedPercent: 60 });
  assert.deepEqual(gearDistributionSummary([{ status: "Picked up" }, { status: "Ready" }, { status: "Needs items" }], 4), { "Picked up": 1, "Ready": 1, "Needs items": 1, "Not packed": 1, completePercent: 25 });
});

test("equipment and uniform plan scales with teams and players", () => {
  const budget = scaledGearBudget({ baseEquipment: 20000, baseUniforms: 38000, basePlayerCount: 1200, baseTeamCount: 100, playerCount: 1500, teamCount: 125 });
  assert.deepEqual(budget, { equipment: 25000, uniforms: 47500, total: 72500, equipmentPerTeam: 200, uniformPerPlayer: 31.666666666666668 });
});
