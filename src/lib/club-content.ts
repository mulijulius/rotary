export const CLUB = {
  name: "Rotary Club of Athi River",
  motto: "Service Above Self",
  district: "Rotary District 9212",
  venue: "East African Portland Sports Club, Athi River",
  meeting: "Every Wednesday, 7:00 PM · Hybrid (Zoom & in-person)",
  email: "rcathiriver@gmail.com",
  phone: "+254 728 608 179",
  postal: "P.O. Box 39221-00623, Parklands, Nairobi, Kenya",
};

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/rotaryclubofathiriver",
  x: "https://x.com/RCathiriver",
  instagram: "https://www.instagram.com/rotaryclubofathiriver/",
};

export const heroStats = [
  { value: "120+", label: "Members Served" },
  { value: "45", label: "Community Projects" },
  { value: "18", label: "Years of Service" },
  { value: "7", label: "Areas of Focus" },
];

export const focusPreview = [
  { icon: "⚫", title: "Peacebuilding", copy: "Preventing conflict, promoting understanding", tone: "bg-cranberry" },
  { icon: "💧", title: "Water & Sanitation", copy: "Clean water and hygiene access", tone: "bg-turquoise" },
  { icon: "🏥", title: "Maternal & Child Health", copy: "Healthier mothers and children", tone: "bg-orange" },
  { icon: "📚", title: "Basic Education", copy: "Literacy and lifelong learning", tone: "bg-royal-bright" },
];

export const areasOfFocus = [
  {
    icon: "⚫",
    title: "Peacebuilding & Conflict Prevention",
    copy: "Addressing the root causes of conflict and building lasting peace in communities.",
    tone: "bg-cranberry",
  },
  {
    icon: "💧",
    title: "Disease Prevention & Treatment",
    copy: "Fighting the world's most threatening diseases through education and care.",
    tone: "bg-turquoise",
  },
  {
    icon: "🚰",
    title: "Water, Sanitation & Hygiene",
    copy: "Providing access to clean water and sanitation for communities in need.",
    tone: "bg-royal-bright",
  },
  {
    icon: "👶",
    title: "Maternal & Child Health",
    copy: "Improving health outcomes for mothers, newborns and children.",
    tone: "bg-orange",
  },
  {
    icon: "📚",
    title: "Basic Education & Literacy",
    copy: "Supporting education and literacy to reduce poverty and inequality.",
    tone: "bg-gold-deep",
  },
  {
    icon: "💼",
    title: "Community Economic Development",
    copy: "Creating jobs and strengthening local economies and entrepreneurs.",
    tone: "bg-violet",
  },
  {
    icon: "🌍",
    title: "Environment",
    copy: "Protecting natural resources through conservation and sustainability projects.",
    tone: "bg-leaf",
  },
  {
    icon: "🤝",
    title: "Youth & Community Development",
    copy: "Empowering young people through mentorship, Rotaract and Interact clubs.",
    tone: "bg-navy-deep",
  },
];

export const fourWayTest = [
  "Is it the TRUTH?",
  "Is it FAIR to all concerned?",
  "Will it build GOODWILL and BETTER FRIENDSHIPS?",
  "Will it be BENEFICIAL to all concerned?",
];

export const objectOfRotary = [
  {
    ordinal: "First.",
    text: "The development of acquaintance as an opportunity for service;",
  },
  {
    ordinal: "Second.",
    text: "High ethical standards in business and professions, and the dignifying of one's occupation as an opportunity to serve society;",
  },
  {
    ordinal: "Third.",
    text: "The application of the ideal of service in each Rotarian's personal, business and community life;",
  },
  {
    ordinal: "Fourth.",
    text: "The advancement of international understanding, goodwill and peace through a world fellowship of business and professional persons united in the ideal of service.",
  },
];

// The board/leadership list used to be hard-coded here. It's now read
// live from board_positions (via v_public_board) — see
// src/lib/public-board.ts and src/routes/leadership.tsx.

export const projectFilters = [
  "All Projects",
  "Water & Sanitation",
  "Education",
  "Health",
  "Economic Development",
  "Environment",
];

export const projects = [
  {
    title: "Kyumbi Community Borehole",
    area: "Water & Sanitation",
    copy: "Drilled and commissioned a solar-powered borehole now serving over 800 households with clean drinking water.",
    date: "Jul 2026",
    photos: "42 photos",
    tone: "gradient-aqua",
  },
  {
    title: "Books & Desks for Athi Primary",
    area: "Education",
    copy: "Delivered 500 textbooks and 60 classroom desks, partnering with the school PTA and county office.",
    date: "Apr 2026",
    photos: "28 photos",
    tone: "gradient-royal",
  },
  {
    title: "Free Maternal Health Camp",
    area: "Health",
    copy: "A weekend medical camp offering free antenatal checkups and health education to 300+ mothers.",
    date: "Feb 2026",
    photos: "35 photos",
    tone: "gradient-warm",
  },
  {
    title: "Micro-Loans for Women Traders",
    area: "Economic Development",
    copy: "Seed funding and business training for 40 women-led micro-enterprises in Athi River market.",
    date: "Nov 2025",
    photos: "19 photos",
    tone: "gradient-gold",
  },
  {
    title: "10,000 Trees for Athi River",
    area: "Environment",
    copy: "A multi-club tree-planting drive along the riverbank in partnership with the Kenya Forest Service.",
    date: "Aug 2025",
    photos: "51 photos",
    tone: "gradient-leaf",
  },
  {
    title: "Rotary Scholars Programme",
    area: "Education",
    copy: "Full secondary school scholarships awarded to 12 bright students from low-income households.",
    date: "Jan 2025",
    photos: "15 photos",
    tone: "gradient-violet",
  },
];

export const events = [
  { day: "20", month: "Aug", title: "Weekly Club Meeting", detail: "12:30 PM · Sportsview Hotel, Athi River" },
  { day: "27", month: "Aug", title: "Board Meeting", detail: "5:00 PM · Club Office, Athi River Town" },
  { day: "05", month: "Sep", title: "Charity Golf Tournament", detail: "7:00 AM · Athi River Golf Club" },
  { day: "12", month: "Sep", title: "Community Health Camp", detail: "9:00 AM · Athi River Social Hall" },
  { day: "26", month: "Sep", title: "Fellowship Dinner", detail: "7:00 PM · Sportsview Hotel" },
];

export const news = [
  {
    date: "12 Aug 2026",
    title: "Club Welcomes Six New Members",
    copy: "Our club continues to grow with new professionals joining from law, medicine, and manufacturing this quarter.",
    tone: "gradient-royal",
  },
  {
    date: "30 Jul 2026",
    title: "Borehole Project Handed Over to Kyumbi Community",
    copy: "After 8 months of work, the solar-powered borehole is now serving over 800 households.",
    tone: "gradient-gold",
  },
  {
    date: "02 Jul 2026",
    title: "President Jane Wambui Installed for 2026–2027",
    copy: "A new Rotary year begins with an ambitious service plan focused on water and education.",
    tone: "gradient-aqua",
  },
  {
    date: "18 Jun 2026",
    title: "Club Recognized for Outstanding Service by District 9212",
    copy: "District Governor commends the club's water and education project portfolio at the annual conference.",
    tone: "gradient-violet",
  },
];

export const galleryAlbums = [
  { title: "Kyumbi Borehole Handover", date: "Jul 2026", tone: "gradient-aqua" },
  { title: "Charity Golf Tournament", date: "Sep 2025", tone: "gradient-gold" },
  { title: "Weekly Fellowship", date: "Ongoing", tone: "gradient-royal" },
  { title: "Tree Planting Drive", date: "Aug 2025", tone: "gradient-leaf" },
  { title: "Maternal Health Camp", date: "Feb 2026", tone: "gradient-warm" },
  { title: "Club Installation Night", date: "Jul 2026", tone: "gradient-violet" },
  { title: "Scholars Award Ceremony", date: "Jan 2025", tone: "gradient-royal" },
  { title: "District 9212 Conference", date: "Jun 2026", tone: "gradient-aqua" },
];

export const homeHighlights = [
  {
    tag: "Event",
    title: "Annual Charity Golf Tournament",
    copy: "Join us on the green to raise funds for the club's education scholarship fund.",
    metaLeft: "Sat, 5 Sep 2026",
    metaRight: "Athi River Golf Club",
    tone: "gradient-royal",
  },
  {
    tag: "Project",
    title: "Borehole Commissioning – Kyumbi",
    copy: "Clean water now flowing to over 800 households after an 8-month project.",
    metaLeft: "Completed Jul 2026",
    metaRight: "Kyumbi Ward",
    tone: "gradient-gold",
  },
  {
    tag: "News",
    title: "Club Welcomes 6 New Members",
    copy: "Our club continues to grow with professionals joining from law, medicine and industry.",
    metaLeft: "12 Aug 2026",
    metaRight: "Club News",
    tone: "gradient-aqua",
  },
];
