import { createBaselineStrategies } from './balanceStrategies.js'
import { simulateStrategy as runSimulation } from './balanceSimulationEngine.js'
import type { SimulatedStrategyResult, StrategyDefinition } from './balanceTypes.js'

export function simulateStrategy(strategy: StrategyDefinition): SimulatedStrategyResult {
  return runSimulation(strategy)
}

export function simulateAllBaselineStrategies(): SimulatedStrategyResult[] {
  return createBaselineStrategies().map((strategy) => runSimulation(strategy))
}

export type { SimulatedStrategyResult, StrategyDefinition } from './balanceTypes.js'
