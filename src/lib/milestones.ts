export interface Milestone {
  miles: number;
  locations: string[];
}

export const MILES_PER_MINUTE = 2.5 / 60;

export const annualMilestones: Milestone[] = [
  { miles: 1.5, locations: ["🏖️ Cleveleys Beach Promenade", "🌳 Jubilee Gardens Cleveleys", "💨 Marsh Mill Windmill (Thornton)", "🦅 Wyre Estuary Country Park", "🏫 Rossall School Grounds"] },
  { miles: 3.0, locations: ["⚓ Fleetwood Pier", "⚽ Highbury Stadium (Fleetwood Town FC)", "🏛️ Marine Hall Fleetwood", "🛍️ Fleetwood Market", "🚨 Pharos Lighthouse"] },
  { miles: 4.5, locations: ["🛒 Poulton-le-Fylde Historic Marketplace", "🌊 Blackpool North Shore Beach", "🪨 Bispham Rock Gardens", "🎡 Blackpool North Pier", "⚓ River Wyre (Wardleys Creek)"] },
  { miles: 6.0, locations: ["🗼 Blackpool Tower", "🎭 Winter Gardens Blackpool", "🛶 Stanley Park Boating Lake", "🎾 South Shore Lawn Tennis Club", "🎪 Grand Theatre Blackpool"] },
  { miles: 7.5, locations: ["🎢 Blackpool Pleasure Beach", "⚡ The Big One Rollercoaster", "🏊 Sandcastle Waterpark", "🏰 Lytham Hall", "⚓ St Annes Pier"] },
  { miles: 9.0, locations: ["💨 Lytham Windmill", "⛵ Fairhaven Lake", "⛳ Royal Lytham & St Annes Golf Club", "🦆 Ribble Estuary Nature Reserve", "🏡 Singleton Village Centre"] },
  { miles: 11.0, locations: ["🏖️ Pilling Sands", "⚓ Knott End-on-Sea Ferry Slipway", "⛵ Lancaster Canal Marina (Garstang)", "🌲 Beacon Fell Country Park", "🧺 Scorton Village Picnic Area"] },
  { miles: 13.5, locations: ["🏰 Lancaster Castle", "🌅 Morecambe Promenade", "🏛️ Ashton Memorial (Williamson Park)", "🏨 Midland Hotel Morecambe", "⛵ Preston Marina"] },
  { miles: 16.0, locations: ["⚽ Deepdale Stadium (Preston)", "🖼️ Harris Museum & Art Gallery", "🐸 Brockholes Nature Reserve", "🏰 Clitheroe Castle Keep", "🌳 Forest of Bowland Centre"] },
  { miles: 19.0, locations: ["⛪ Barrow-in-Furness Abbey", "🦁 South Lakes Safari Zoo", "🏰 Piel Island Castle", "🧙‍♀️ Pendle Hill Summit", "🏫 Stonyhurst College Estate"] },
  { miles: 22.0, locations: ["⚓ Southport Pier", "⛳ Royal Birkdale Golf Club", "🐿️ Formby Beach & Red Squirrel Reserve", "🦆 Martin Mere WWT Wetland Centre", "🐎 Cartmel Racecourse"] },
  { miles: 25.0, locations: ["⛵ Lake Windermere (Bowness Waterfront)", "🏰 Kendal Castle Ruins", "🏰 Sizergh Castle", "🏫 Scarisbrick Hall", "🚂 Bolton Abbey Wharf"] },
  { miles: 29.0, locations: ["🐎 Aintree Racecourse", "⚽ Goodison Park (Everton FC)", "⚽ Anfield Stadium (Liverpool FC)", "⚓ Royal Albert Dock Liverpool", "🎸 The Cavern Club"] },
  { miles: 33.0, locations: ["⚽ Toughsheet Community Stadium (Bolton)", "🏰 Chorley Astley Hall", "⚓ Wigan Pier Terminal", "🐎 Haydock Park Racecourse", "🏟️ Leigh Sports Village"] },
  { miles: 38.0, locations: ["⚽ Old Trafford Stadium (Manchester)", "🎤 AO Arena Manchester", "🎬 MediaCityUK (Salford Quays)", "🪖 Imperial War Museum North", "🛍️ The Trafford Centre Dome"] },
  { miles: 43.0, locations: ["⚽ Etihad Stadium (Manchester City FC)", "🥾 Kinder Scout Plateau (Peak District)", "🔭 Jodrell Bank Observatory", "🏰 Tatton Park Mansion", "🦁 Chester Zoo Animal Kingdom"] },
  { miles: 48.0, locations: ["🏛️ Chester Roman Amphitheatre", "🌊 Llangollen Canal Aqueduct", "🏰 Lyme Park (Pride & Prejudice House)", "🌲 Delamere Forest Trails", "🏰 Beeston Castle Crag"] },
  { miles: 53.0, locations: ["🏰 Conwy Castle Walls", "⚓ Llandudno Pier Promenade", "🚃 Great Orme Tramway", "🏔️ Snowdonia National Park Pass", "🏰 Penrhyn Castle Quarry"] },
  { miles: 59.0, locations: ["🏰 Carlisle Castle Historic Fortress", "🧱 Hadrian's Wall (Birdoswald Fort)", "🏔️ Skiddaw Mountain Peak", "🪨 Malham Cove Limestone Pavement", "🦇 Ingleborough Cave"] },
  { miles: 65.0, locations: ["⛪ York Minster Cathedral", "🏰 Fountains Abbey Ruins", "⛪ Ripon Cathedral Crypt", "⚔️ Leeds Royal Armouries Museum", "🏟️ Headingley Stadium Complex"] },
  { miles: 72.0, locations: ["🏰 Chatsworth House Gardens", "🎢 Alton Towers Resort Theme Park", "🎭 Sheffield Crucible Theatre", "🥾 Mam Tor Ridge Walk", "🌳 Sherwood Forest (Major Oak)"] },
  { miles: 80.0, locations: ["🏰 Holy Island of Lindisfarne Castle", "🏖️ Bamburgh Castle Beach", "🏰 Alnwick Castle (Harry Potter Courtyard)", "🌌 Kielder Observatory Forest", "🚂 Snowdon Summit Station"] },
  { miles: 89.0, locations: ["⚽ St James' Park (Newcastle United FC)", "👼 Angel of the North Sculpture", "⛪ Durham Cathedral Enclosure", "🏰 Beaumaris Castle Moat", "🏡 Portmeirion Italianate Village"] },
  { miles: 100.0, locations: ["⚙️ Ironbridge Gorge Museum", "🏢 National Exhibition Centre (NEC Birmingham)", "🏏 Edgbaston Cricket Ground", "🏰 Wollaton Hall (Batman's Wayne Manor)", "🚀 National Space Centre Leicester"] },
  { miles: 112.0, locations: ["🚢 Belfast Titanic Quarter Museum", "🏰 Belfast Castle Estate", "🥾 Cadair Idris Mountain Track", "⚽ Villa Park Stadium (Birmingham)", "⛪ Coventry Cathedral Ruins"] },
  { miles: 125.0, locations: ["🏰 Edinburgh Castle Royal Mile", "🌋 Arthur's Seat Volcanic Summit", "🏉 Murrayfield Rugby Stadium", "⛪ Glasgow Cathedral Vaults", "🏛️ George Square Center (Glasgow)"] },
  { miles: 140.0, locations: ["🏟️ Croke Park Stadium (Dublin)", "🍺 Guinness Storehouse Gravity Bar", "📚 Trinity College Long Room Library", "🎭 Stratford-upon-Avon (Shakespeare's Birthplace)", "🏰 Warwick Castle Dungeon"] },
  { miles: 160.0, locations: ["🏰 Cardiff Castle Keep", "🏟️ Principality Stadium (Cardiff)", "🏔️ Brecon Beacons National Park Ridge", "🛶 Bourton-on-the-Water (Cotswolds)", "🏰 Blenheim Palace Gardens"] },
  { miles: 185.0, locations: ["⚽ Wembley Stadium Arch (London)", "🎡 The London Eye Ferris Wheel", "🏰 Tower of London Fortress", "🏰 Buckingham Palace Gates", "📚 Oxford University Bodleian Library"] },
  { miles: 215.0, locations: ["🏎️ Silverstone Circuit Grid Line", "🕵️ Bletchley Park Codebreaking Huts", "⛪ King's College Chapel Cambridge", "🦌 Woburn Abbey Deer Park", "⛪ St Paul's Cathedral Whispering Gallery"] },
  { miles: 250.0, locations: ["🦕 Loch Ness (Urquhart Castle Lookout)", "⛷️ Cairngorms National Park Ski Slopes", "🏰 Inverness Castle Terrace", "⛪ Canterbury Cathedral Nave", "🏰 Leeds Castle Moat (Kent)"] },
  { miles: 290.0, locations: ["🪨 Stonehenge Stone Circle", "🏛️ Roman Baths Complex (Bath)", "🦁 Longleat Safari Park Woods", "⛪ Norwich Cathedral Spire", "🏰 Sandingham House Royal Estate"] },
  { miles: 335.0, locations: ["🪧 Land's End Coastal Signpost", "🏰 St Michael's Mount Island", "🌱 Eden Project Biomes (Cornwall)", "🏰 Tintagel Castle Bridge", "🚨 Isle of Wight (The Needles Lighthouse)"] },
  { miles: 385.0, locations: ["🗼 Eiffel Tower Base (Paris)", "🏛️ Arc de Triomphe Plaza", "🖼️ Louvre Museum Glass Pyramid", "⛲ Manneken Pis Fountain (Brussels)", "🏛️ Grand Place Guildhouses (Brussels)"] },
  { miles: 440.0, locations: ["🖼️ Rijksmuseum Art Galleries (Amsterdam)", "🏠 Anne Frank House Canal", "🖼️ Van Gogh Museum Display", "🏛️ Bruges Historic Market Square & Belfry", "🏰 Ghent Gravensteen Castle"] },
  { miles: 500.0, locations: ["🚂 Antwerp Central Station Concourse", "🏠 Rotterdam Cube Houses", "🌲 Efteling Theme Park Forest", "🏛️ Cork City Custom House (Ireland)", "🚢 Cobh Harbour Titanic Last Port"] },
  { miles: 550.0, locations: ["⛪ Cologne Cathedral Towers (Germany)", "🌅 Ring of Kerry Coastal Path", "⛰️ Dingle Peninsula Cliffs", "🏔️ Ben Nevis Mountain Summit", "⛳ St Andrews Old Course Swilcan Bridge"] },
  { miles: 580.0, locations: ["🏞️ Isle of Skye Fairy Pools", "🏰 Eilean Donan Castle Bridge", "🚢 Aberdeen Maritime Museum", "🏰 Palace of Versailles Hall of Mirrors", "🏰 Luxembourg City Casemates Fortress"] },
  { miles: 615.0, locations: ["🏛️ Frankfurt am Main Roemer Square", "🎻 Hamburg Elbphilharmonie Concert Hall", "🌲 Black Forest Mountain Trail", "🍷 Bordeaux Wine Cultural Center", "🪧 John o' Groats Northern Landmark"] },
  { miles: 650.0, locations: ["🏛️ Brandenburg Gate (Berlin)", "🧱 Berlin Wall Memorial Checkpoint", "🧜‍♀️ Copenhagen Little Mermaid Statue", "🎡 Tivoli Gardens Theme Park (Copenhagen)", "⛪ Milan Cathedral Duomo Roof Tiles"] },
];

export function pickLocation(miles: number, year: number): string {
  const idx = Math.abs(Math.floor(miles * 10) + year) % 5;
  const m = annualMilestones.find((mi) => mi.miles === miles);
  return m ? m.locations[idx] : "";
}

/** Stable, year-scoped registry key for one annual walking milestone. */
export function milestoneRegistryId(year: number, miles: number): string {
  const threshold = String(miles).replace(".", "_");
  return `${year}_milestone_${threshold}_miles`;
}

/** Indices of milestones newly crossed when miles moves from prev to next. */
export function newlyCrossedMilestones(prevMiles: number, nextMiles: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < annualMilestones.length; i++) {
    const t = annualMilestones[i].miles;
    if (prevMiles < t && nextMiles >= t) out.push(i);
  }
  return out;
}