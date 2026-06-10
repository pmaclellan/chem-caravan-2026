export const CONFIG = {
  STARTING_CAPS: 2000,
  STARTING_DEBT: 2000,
  STARTING_HEALTH: 100,
  MAX_TURNS: 31,
  INTEREST_RATE: 0.065,      // applied per travel turn
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

} as const
