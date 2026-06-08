import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { fetchLogs, totalWalkMinutes, type DailyLog } from "@/lib/daily-logs";
import { ExternalLink, MapPin } from "lucide-react";
import rosieLogo from "@/assets/rosie-icon.png";

export const Route = createFileRoute("/distance-covered")({
  component: DistanceCoveredPage,
  head: () => ({
    meta: [
      { title: "Where Has Rosie Been? — Rosie Health Hub" },
      { name: "description", content: "Annual walking challenge for Rosie." },
    ],
  }),
});

const annualMilestones: { miles: number; locations: string[] }[] = [
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

function pickLocation(miles: number, year: number): string {
  const idx = Math.abs(Math.floor(miles * 10) + year) % 5;
  const m = annualMilestones.find((mi) => mi.miles === miles);
  return m ? m.locations[idx] : "";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} and ${m} minute${m === 1 ? "" : "s"}`;
}

function exploreUrl(name: string): string {
  // Strip leading emoji + space for cleaner search query
  const clean = name.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+\s*/u, "");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

function DistanceCoveredPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);

  const now = new Date();
  const year = now.getFullYear();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 400)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  const { totalMinutes, totalMiles, currentMilestone, nextMilestone, progressPct, unlockedTimeline } = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearLogs = logs
      .filter((l) => l.log_date >= yearStart)
      .sort((a, b) => a.log_date.localeCompare(b.log_date));
    const totalMinutes = yearLogs.reduce((s, l) => s + totalWalkMinutes(l.walks), 0);
    const totalMiles = (totalMinutes * 2.5) / 60;

    let currentIdx = -1;
    for (let i = 0; i < annualMilestones.length; i++) {
      if (totalMiles >= annualMilestones[i].miles) currentIdx = i;
      else break;
    }
    const currentMilestone = currentIdx >= 0 ? annualMilestones[currentIdx] : annualMilestones[0];
    const nextMilestone = annualMilestones[currentIdx + 1] ?? null;

    const prevMiles = currentIdx >= 0 ? annualMilestones[currentIdx].miles : 0;
    const targetMiles = nextMilestone ? nextMilestone.miles : prevMiles;
    const progressPct = nextMilestone
      ? Math.min(100, Math.max(0, ((totalMiles - prevMiles) / (targetMiles - prevMiles)) * 100))
      : 100;

    // Build unlock timeline by walking through year logs
    let running = 0;
    let nextThresholdIdx = 0;
    const unlocks: { milestoneIdx: number; date: string }[] = [];
    for (const l of yearLogs) {
      const mins = totalWalkMinutes(l.walks);
      running += (mins * 2.5) / 60;
      while (nextThresholdIdx < annualMilestones.length && running >= annualMilestones[nextThresholdIdx].miles) {
        unlocks.push({ milestoneIdx: nextThresholdIdx, date: l.log_date });
        nextThresholdIdx++;
      }
    }
    const unlockedTimeline = unlocks.reverse();

    return { totalMinutes, totalMiles, currentMilestone, nextMilestone, progressPct, unlockedTimeline };
  }, [logs, year]);

  if (isLoading || !mounted) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  const activeLocation = pickLocation(currentMilestone.miles, year);
  const remainingMinutes = nextMilestone ? Math.ceil(((nextMilestone.miles - totalMiles) * 60) / 2.5) : 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-[oklch(0.97_0.04_220)] via-background to-[oklch(0.97_0.04_145)] dark:bg-none dark:bg-zinc-800">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pt-10 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-up-blur">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Where Has Rosie Been?</h1>
          </div>
          <Link to="/profile">
            <img src={rosieLogo} alt="Rosie" className="h-12 w-12 rounded-full object-cover" />
          </Link>
        </div>

        {/* Summary card */}
        <div className="mt-6 rounded-3xl p-5 bg-gradient-to-br from-[oklch(0.92_0.10_220)] to-[oklch(0.94_0.08_280)] border border-[oklch(0.85_0.06_220)] shadow-sm animate-fade-up-blur dark:bg-none dark:bg-black dark:border-zinc-800">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[oklch(0.4_0.15_220)] dark:text-white">
            Annual Walking Challenge {year}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 dark:text-white">{formatDate(now)}</p>
          <p className="mt-3 text-sm leading-relaxed text-foreground dark:text-white">
            So far this year, you and Rosie have walked{" "}
            <span className="font-bold text-[oklch(0.45_0.18_220)] dark:text-white">{formatDuration(totalMinutes)}</span>
            , covering a total calculated distance of{" "}
            <span className="font-bold text-[oklch(0.45_0.18_145)] dark:text-white">{totalMiles.toFixed(2)} miles</span>!
          </p>
        </div>

        {/* Progress / map */}
        <div className="mt-5 rounded-3xl p-5 bg-card border border-border shadow-sm animate-fade-up-blur">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{currentMilestone.miles} mi</span>
            <span>{nextMilestone ? `${nextMilestone.miles} mi` : "Max!"}</span>
          </div>
          <div className="relative mt-2 h-4 rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[oklch(0.75_0.15_220)] to-[oklch(0.72_0.16_145)] rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-card border-2 border-primary shadow-md flex items-center justify-center text-base transition-all duration-700 overflow-hidden"
              style={{ left: `${progressPct}%` }}
              aria-label="Rosie's position"
            >
              <img src={rosieLogo} alt="Rosie" className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="mt-5 rounded-2xl p-4 bg-[oklch(0.97_0.05_145)] border border-[oklch(0.85_0.08_145)] dark:bg-zinc-900 dark:border-zinc-800">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-[oklch(0.4_0.15_145)] dark:text-white">
              Current Stop
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground leading-snug dark:text-white">
              {activeLocation}!
            </p>
            <a
              href={exploreUrl(activeLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform"
            >
              <MapPin className="w-4 h-4" /> Explore!
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>

          {nextMilestone && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Walk <strong className="text-foreground">{remainingMinutes} more minutes</strong> to reach the next mystery location!
            </p>
          )}
        </div>

        {/* Timeline */}
        <div className="mt-6 animate-fade-up-blur">
          <h2 className="text-lg font-semibold text-foreground tracking-tight dark:text-white">Rosie's Travel Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5 dark:text-white">Milestones unlocked in {year}</p>

          {unlockedTimeline.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No milestones reached yet this year. Keep walking!
            </div>
          ) : (
            <div className="mt-4 relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" aria-hidden />
              <div className="space-y-3">
                {unlockedTimeline.map(({ milestoneIdx, date }) => {
                  const m = annualMilestones[milestoneIdx];
                  const loc = pickLocation(m.miles, year);
                  const [y, mo, d] = date.split("-").map(Number);
                  const dateStr = formatDate(new Date(y, mo - 1, d));
                  return (
                    <div key={milestoneIdx} className="relative pl-10">
                      <div className="absolute left-2 top-3 h-5 w-5 rounded-full bg-primary border-2 border-card shadow" />
                      <div className="rounded-2xl bg-card border border-border p-3.5 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] uppercase tracking-widest font-semibold text-[oklch(0.45_0.18_220)]">
                            {m.miles} mi
                          </span>
                          <span className="text-[11px] text-muted-foreground">Unlocked {dateStr}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground leading-snug">{loc}</p>
                        <a
                          href={exploreUrl(loc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <MapPin className="w-3 h-3" /> Explore
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}