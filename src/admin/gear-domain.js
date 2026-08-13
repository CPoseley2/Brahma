const number = value => Math.max(0, Number(value) || 0);

export const GEAR_PLAYER_STEP = 50;

export function normalizeGearPlayerCount(value, { min = 50, max = 2500 } = {}) {
  const rounded = Math.round(number(value) / GEAR_PLAYER_STEP) * GEAR_PLAYER_STEP;
  return Math.min(max, Math.max(min, rounded || min));
}

export function gearPlan(items = [], playerCount = 1200, playersPerTeam = 12) {
  const players = normalizeGearPlayerCount(playerCount); const teamCount = Math.ceil(players / Math.max(1, number(playersPerTeam)));
  const lines = items.map(item => {
    const basisCount = item.basis === "player" ? players : item.basis === "team" ? teamCount : 1;
    const rawQuantity = basisCount * number(item.rate || 1); const packSize = Math.max(1, Math.round(number(item.packSize || 1)));
    const quantity = Math.ceil(rawQuantity / packSize) * packSize; const unitCost = number(item.unitCost);
    return { ...item, quantity, unitCost, estimatedCost: quantity * unitCost };
  });
  const vendorTotals = lines.reduce((totals, item) => { totals[item.vendor] = (totals[item.vendor] || 0) + item.estimatedCost; return totals; }, {});
  const total = lines.reduce((sum, item) => sum + item.estimatedCost, 0);
  return { playerCount: players, teamCount, playersPerTeam, lines, vendorTotals, total, perPlayer: players ? total / players : 0 };
}

export function scaledGearBudget({ baseEquipment = 0, baseUniforms = 0, basePlayerCount = 0, baseTeamCount = 0, playerCount = 0, teamCount = 0 } = {}) {
  const baselinePlayers = Math.max(1, number(basePlayerCount)); const baselineTeams = Math.max(1, number(baseTeamCount));
  const equipment = number(baseEquipment) * number(teamCount) / baselineTeams; const uniforms = number(baseUniforms) * number(playerCount) / baselinePlayers;
  return { equipment, uniforms, total: equipment + uniforms, equipmentPerTeam: number(baseEquipment) / baselineTeams, uniformPerPlayer: number(baseUniforms) / baselinePlayers };
}

export function gearOrderSummary(items = []) {
  const orderedSpend = items.reduce((sum, item) => sum + number(item.actualSpend), 0); const ordered = items.reduce((sum, item) => sum + number(item.orderedQty), 0);
  const received = items.reduce((sum, item) => sum + Math.min(number(item.receivedQty), number(item.orderedQty)), 0); const distributed = items.reduce((sum, item) => sum + Math.min(number(item.distributedQty), number(item.receivedQty)), 0);
  return { orderedSpend, ordered, received, distributed, receivedPercent: ordered ? Math.round(received / ordered * 100) : 0, distributedPercent: ordered ? Math.round(distributed / ordered * 100) : 0 };
}

export function gearDistributionSummary(distributions = [], teamCount = 0) {
  const counts = { "Picked up": 0, "Ready": 0, "Needs items": 0, "Not packed": 0 };
  distributions.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
  counts["Not packed"] += Math.max(0, Number(teamCount) - distributions.length);
  return { ...counts, completePercent: teamCount ? Math.round(counts["Picked up"] / teamCount * 100) : 0 };
}
