export const CONFIG = {
  STARTING_CAPS: 2000,
  STARTING_DEBT: 2000,
  STARTING_HEALTH: 100,
  MAX_TURNS: 31,
  INTEREST_RATE: 0.05,       // applied per travel turn
  STARTING_BRAHMIN: 1,
  BASE_CAPACITY: 20,
  CAPACITY_PER_BRAHMIN: 10,

  DEBT_ENFORCEMENT: [
    { age: 5,  damage: 30, message: "Triggermen thugs find you on the road. They rough you up as a reminder." },
    { age: 10, damage: 50, message: "They're back, and less patient this time. They break two ribs." },
    { age: 12, damage: 999, message: "The last thing you see is the caps logo on a Triggerman's ring." },
  ],

  GUARD_COST: 150,          // caps per guard hired
  GUARD_HEALTH: 40,         // HP each guard absorbs before player takes damage
  BRAHMIN_COST: 300,        // caps per brahmin purchased

  DOCTOR_COST: 200,         // caps to fully heal at Diamond City
  DOCTOR_COST_CHEAP: 100,   // caps at other settlements

  EVENT_BASE_PROB: 0.10,    // minimum chance of a travel event on any road
  EVENT_DANGER_SCALE: 0.60, // how much road danger amplifies event probability
  DEBT_COLLECTOR_MIN_AGE: 5,
  DEBT_COLLECTOR_PROB: 0.30,

  MARKET_EVENT_PROB_PER_TURN: 0.15,   // chance a new market event fires each turn
  MARKET_EVENT_DURATION_MIN: 2,
  MARKET_EVENT_DURATION_MAX: 5,
  SHORTAGE_MULTIPLIER_MIN: 2.0,
  SHORTAGE_MULTIPLIER_MAX: 4.0,
  SURPLUS_MULTIPLIER_MIN: 0.25,
  SURPLUS_MULTIPLIER_MAX: 0.55,
} as const
