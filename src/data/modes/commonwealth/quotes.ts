export interface TransitQuote {
  text: string
  speaker: string
}

// Overheard on the road — in the spirit of Dope Wars' subway flavor text.
// Wasteland travelers, merchants, settlers, and the occasionally philosophical raider.
// "Omniscient Guide" entries are gameplay tips for new players.
export const TRANSIT_QUOTES: TransitQuote[] = [
  // Merchants & trade
  { text: "Jet prices out of Diamond City are criminal. Even by wasteland standards.", speaker: "Brahmin drover" },
  { text: "Stock up on RadAway before you hit the southern roads. That's not a suggestion.", speaker: "Pack merchant" },
  { text: "Made enough off one Stimpak run to pay my Bunker Hill rent for a year. A whole year.", speaker: "Caravan guard" },
  { text: "Three years I ran Ultrajet. Now everyone wants Mentats. The market is a cruel mistress.", speaker: "Weathered chem runner" },
  { text: "A wise woman told me: buy low, sell high, don't die. Wisest woman I ever met.", speaker: "Old junk trader" },
  { text: "You can smell the markup on every chem in Goodneighbor. They don't even try to hide it.", speaker: "Diamond City merchant" },
  { text: "Pre-war money. Still carrying pre-war money. My grandfather's idea. Grandfather was an idiot.", speaker: "Pre war book dealer" },

  // Road conditions & danger
  { text: "Quincy's full of Gunners now. I don't care what's on the table, I won't run that road.", speaker: "Nervous trader" },
  { text: "Lost two brahmin on the south freeway last week. The insurance alone is gonna kill me.", speaker: "Exhausted merchant" },
  { text: "Coastal highway is not a shortcut. Anyone who tells you it is — they are lying and they know it.", speaker: "Scarred caravan driver" },
  { text: "I saw a Deathclaw near the old quarry. Just standing there. Looking at a rock. Philosophically.", speaker: "Shaken traveler" },
  { text: "Brotherhood confiscated twelve crates of Psycho at the checkpoint. Twelve crates.", speaker: "Gossiping trader" },
  { text: "The raiders on Route 3 have a schedule now. I've charted it. Tuesday is safe.", speaker: "Very organized merchant" },

  // Settlement gossip
  { text: "Diamond City Security fined me forty caps for loitering. In front of my own stall.", speaker: "Market vendor" },
  { text: "The robot at Graygarden told me I was 'inefficient.' A robot. Told me.", speaker: "Wandering farmer" },
  { text: "Goodneighbor acts like they invented crime. They didn't. They just franchised it.", speaker: "Underground merchant" },
  { text: "The Minutemen put up another relay tower. Fourth one this month. I appreciate the effort, I do.", speaker: "Settlement farmer" },
  { text: "I keep telling people — the water in Vault 81 is actually quite good. They just don't believe me.", speaker: "Vault 81 resident" },
  { text: "They call Diamond City the jewel of the Commonwealth. Compared to what?", speaker: "Cynical settler" },
  { text: "The Castle's looking better. The Minutemen are trying. I'll say that much — they're trying.", speaker: "Traveling tinker" },

  // Addiction & chems
  { text: "Rad-X is not a food group. I cannot stress this enough.", speaker: "Traveling doctor" },
  { text: "My whole caravan is on Buffout now. But we carry twice the load, so... jury's out.", speaker: "Pragmatic merchant" },
  { text: "I quit Jet. Twice. Working on a third.", speaker: "Very honest wastelander" },

  // Wasteland philosophy
  { text: "I used to have a five-year plan. The bombs went off in year two.", speaker: "Pre-war ghoul" },
  { text: "Every settlement I've ever loved has been on fire when I left it.", speaker: "Weary wanderer" },
  { text: "I asked the Gunners what they were guarding. They shot at me. I still don't know.", speaker: "Curious traveler" },
  { text: "The wasteland doesn't owe you anything. It's made that pretty clear.", speaker: "Scarred brahmin trader" },
  { text: "Keep your head down, your pack full, and your gun loaded. Everything else is negotiable.", speaker: "Old caravan hand" },

  // Gameplay tips
  { text: "Guards improve your odds of escaping an ambush and fight alongside you. Brahmin carry more chems but slow you down when things go wrong. Pack accordingly.", speaker: "Omniscient Guide" },
  { text: "Interest compounds every turn you carry debt. Paying it off faster isn't just safer — it's cheaper.", speaker: "Omniscient Guide" },
  { text: "The price color on each chem tells you where it sits relative to the market average. Green is cheap. Red is expensive. Positions shift every turn.", speaker: "Omniscient Guide" },
  { text: "Armor absorbs flat damage every hit. On dangerous roads it pays for itself quickly — but it needs repairs after heavy encounters.", speaker: "Omniscient Guide" },
  { text: "If your pack is full when you find a chem stash, you can swap items on the spot. Drop something low-value, take something better.", speaker: "Omniscient Guide" },

  { text: "Power Armor guards cost more than regular guards but absorb enormous punishment. Worth it on the highest-danger roads.", speaker: "Omniscient Guide" },
  { text: "The Triggermen start with warnings. Miss enough payment windows and they stop warning.", speaker: "Omniscient Guide" },
  { text: "Gwinnett Ale is cheap and plentiful across the Commonwealth — easy early cash flow. Stimpaks and Ultrajet are where the real margins are, if you can afford to stock them.", speaker: "Omniscient Guide" },
  { text: "Bunker Hill sits at the center of the Commonwealth's trade routes. If you're not sure where to sell, start there.", speaker: "Omniscient Guide" },
  { text: "You can own multiple guns. Equip whichever you want before heading out — swap at any settlement. Running dry on ammo just means your guards carry the fight until you restock.", speaker: "Omniscient Guide" },
]

export function pickQuote(): TransitQuote {
  return TRANSIT_QUOTES[Math.floor(Math.random() * TRANSIT_QUOTES.length)]
}
