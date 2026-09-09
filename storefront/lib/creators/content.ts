import type { Audience, Discipline, Focus, Region } from "./types";

export const CREATOR_PRIVACY_VERSION = "creator-privacy-2026-09-09";

export const creatorCopy = {
  name: "ECL Creator Collective",
  route: "/creators",
  cta: "Apply to the collective",
  applicationAnchor: "#apply",
  startingFeeCents: 30_000,
  currency: "AUD",
  heading: ["Your influence.", "Our next chapter."],
  heroBody:
    "For fitness creators, health storytellers and curious minds. Bring your perspective to paid creative collaborations with East Coast Labs.",
  practical: "Australia · 18+ · No minimum follower count",
  supportEmailFallback: "eclpeptides@gmail.com",
} as const;

export const disciplineOptions: Array<{ value: Discipline; label: string }> = [
  { value: "photography", label: "Photography" },
  { value: "video", label: "Video" },
  { value: "content", label: "Content creation" },
];

export const focusOptions: Array<{ value: Focus; label: string }> = [
  { value: "fitness", label: "Fitness" },
  { value: "health", label: "Everyday health" },
  { value: "biohacking", label: "Biohacking" },
  { value: "other", label: "Other" },
];

export const regionOptions: Array<{ value: Region; label: string }> = [
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
].map((value) => ({ value: value as Region, label: value }));

export const audienceOptions: Array<{ value: Audience | ""; label: string }> = [
  { value: "", label: "Prefer not to say" },
  { value: "under-1k", label: "Under 1k" },
  { value: "1k-10k", label: "1k-10k" },
  { value: "10k-50k", label: "10k-50k" },
  { value: "50k-plus", label: "50k+" },
];

export const creatorAssets = {
  cover: {
    src: "/images/creators/cover-celebration-1600.webp",
    width: 1600,
    height: 800,
    alt: "Fictional adult creators celebrating together in an East Coast Labs campaign concept.",
    objectPosition: "50% 50%",
    synthetic: true,
    publicationStatus: "concept",
    caption: "AI-generated campaign imagery featuring fictional creators.",
    master: "docs/creator-program/assets/cover-celebration.png",
    peopleCountReviewed: 18,
    bytes: 152_638,
  },
  fitness: {
    src: "/images/creators/fitness-creator-960.webp",
    width: 960,
    height: 1200,
    alt: "Fictional fitness creator holding a sealed East Coast Labs vial as a creative prop.",
    objectPosition: "50% 45%",
    synthetic: true,
    publicationStatus: "concept",
    master: "docs/creator-program/assets/fitness-creator.png",
    bytes: 81_322,
  },
  health: {
    src: "/images/creators/health-creator-960.webp",
    width: 960,
    height: 1200,
    alt: "Fictional everyday health creator holding a sealed East Coast Labs vial as a creative prop.",
    objectPosition: "50% 45%",
    synthetic: true,
    publicationStatus: "concept",
    master: "docs/creator-program/assets/health-creator.png",
    bytes: 128_336,
  },
  biohacker: {
    src: "/images/creators/biohacker-creator-960.webp",
    width: 960,
    height: 1200,
    alt: "Fictional biohacking storyteller holding a sealed East Coast Labs vial as a creative prop.",
    objectPosition: "45% 45%",
    synthetic: true,
    publicationStatus: "concept",
    master: "docs/creator-program/assets/biohacker-creator.png",
    bytes: 74_100,
  },
  editorial: {
    src: "/images/creators/hero-editorial-960.webp",
    width: 960,
    height: 640,
    alt: "Fictional creator in a warm editorial studio with a sealed East Coast Labs vial.",
    objectPosition: "68% 50%",
    synthetic: true,
    publicationStatus: "concept",
    master: "docs/creator-program/assets/hero-editorial.png",
    bytes: 33_314,
  },
  studio: {
    src: "/images/creators/portrait-studio-640.webp",
    width: 640,
    height: 800,
    alt: "Fictional creator in a cool studio portrait with a sealed East Coast Labs vial.",
    objectPosition: "50% 50%",
    synthetic: true,
    publicationStatus: "concept",
    master: "docs/creator-program/assets/portrait-studio.png",
    bytes: 48_970,
  },
} as const;

export const creatorCategoryPanels = [
  {
    index: "01",
    title: "Fitness creators.",
    copy: "Bring the energy, discipline and visual storytelling that make your content yours.",
    asset: creatorAssets.fitness,
  },
  {
    index: "02",
    title: "Everyday health voices.",
    copy: "Make considered ideas feel approachable, familiar and human.",
    asset: creatorAssets.health,
  },
  {
    index: "03",
    title: "Biohacking storytellers.",
    copy: "Turn curiosity into original content with a clear point of view.",
    asset: creatorAssets.biohacker,
  },
] as const;

export const creatorFaqs = [
  {
    question: "Do I need a large following?",
    answer:
      "No. For creative briefs, we assess the quality and relevance of your work, rather than setting a minimum follower count.",
  },
  {
    question: "How are creators paid?",
    answer:
      "Selected briefs start at A$300. Deliverables, fees, usage rights and payment dates are agreed before work begins. The fee shown is in AUD, excluding GST where applicable.",
  },
  {
    question: "Does applying guarantee a paid brief?",
    answer:
      "No. We review applications and contact creators when there is a suitable opportunity.",
  },
  {
    question: "Do I have to post on my own account?",
    answer:
      "Only if posting is explicitly included in a separate agreed scope. A content-production brief does not automatically require a public endorsement.",
  },
  {
    question: "Do I have to buy or use a product?",
    answer:
      "No purchase or personal product use is required. The brief specifies any props and what can be shown.",
  },
  {
    question: "Who owns the content?",
    answer:
      "You retain ownership unless a separate agreement says otherwise. Each brief sets out ECL's agreed usage licence. Additional paid advertising or extended use is negotiated separately.",
  },
  {
    question: "Is this an affiliate program?",
    answer:
      "The initial program focuses on paid creative briefs. There is no sales commission offer in this launch.",
  },
  {
    question: "Can I apply from outside Australia?",
    answer: "The initial program is for Australia-based creators aged 18 or over.",
  },
] as const;
