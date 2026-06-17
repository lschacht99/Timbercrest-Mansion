/* Shared site data — mirrors the React data so JS-driven pieces
   (universal search, booking page) stay in sync. */
window.TC = {
  WORKER_BASE: "https://fletschhorn-guesty-api.bookings-e2d.workers.dev",
  WORKER_URL: "https://fletschhorn-guesty-api.bookings-e2d.workers.dev/api/book",

  PROPERTIES: [
    { id: "the-timbercrest", listingId: "6968339ab7d735001ca015ba",
      name: "The Timbercrest", bedrooms: 12, guests: 32, baths: 12.5,
      nightlyFrom: 2450, minNights: 2, pets: "allowed", rating: 4.97, reviews: 86,
      city: "West Dover, Vermont", g1: "#3a3f49", g2: "#16181d",
      blurb: "12BR · Sleeps 32 · Indoor pool · Hot tub" },
    { id: "the-myrtle", name: "The Myrtle", bedrooms: 7, guests: 18, baths: 4,
      nightlyFrom: 1280, minNights: 2, pets: "fee", rating: 4.92, reviews: 64,
      city: "Dover, Vermont", g1: "#6e5840", g2: "#372a1d",
      blurb: "7BR · Sleeps 18 · Hot tub · Pool" },
    { id: "the-birch", name: "The Birch", bedrooms: 13, guests: 32, baths: 11,
      nightlyFrom: 2300, minNights: 2, pets: "no", rating: 4.95, reviews: 71,
      city: "Dover, Vermont", g1: "#54687a", g2: "#26333e",
      blurb: "13BR · Sleeps 32 · 2 min to lifts" },
    { id: "the-mahogany", name: "The Mahogany", bedrooms: 9, guests: 22, baths: 9.5,
      nightlyFrom: 1750, minNights: 2, pets: "allowed", rating: 4.94, reviews: 58,
      city: "Dover, Vermont", g1: "#7a4a3a", g2: "#37201a",
      blurb: "9BR · Sleeps 22 · Hot tub · Pool" },
  ],

  PETS_LABEL: { allowed: "Pets welcome", fee: "Pets welcome (fee applies)", no: "No pets" },

  ACTIVITIES: [
    { name: "Mount Snow Resort", season: "winter", q: "skiing snow mountain lifts" },
    { name: "Carinthia Parks", season: "winter", q: "terrain park freestyle" },
    { name: "Snowmobile & dog sledding", season: "winter", q: "snowmobile dog sled" },
    { name: "Snow tubing", season: "winter", q: "tubing kids" },
    { name: "Bluebird Express foliage rides", season: "fall", q: "foliage chairlift leaves" },
    { name: "Mt. Olga fire tower", season: "fall", q: "hike view foliage" },
    { name: "Valley Trail", season: "summer", q: "bike walk wilmington" },
    { name: "Lake & summer adventure", season: "summer", q: "lake swim paddle golf" },
    { name: "Adams Family Farm", season: "all", q: "farm animals kids maple" },
    { name: "Wilmington village", season: "all", q: "shops galleries brewery restaurants" },
    { name: "Dot's Restaurant", season: "all", q: "diner food" },
  ],

  EVENTS: [
    { name: "Weddings", hint: "Ceremonies, carriage-barn receptions, whole-hillside buyouts" },
    { name: "Family reunions", hint: "26-year traditions start here" },
    { name: "Corporate retreats", hint: "Ballrooms, libraries, breakout spaces" },
    { name: "Milestones & parties", hint: "Anniversaries, galas, big birthdays" },
  ],

  CLEANING_PER_HOUSE: 650,
};
