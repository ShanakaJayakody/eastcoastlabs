import type { Audience, Discipline, Focus, Region } from "./types";

export const CREATOR_PRIVACY_VERSION = "creator-privacy-2026-09-09-v3";

export const creatorCopy = {
  name: "ECL Creator Collective",
  route: "/creators",
  cta: "Apply to the collective",
  applicationAnchor: "#apply",
  firstProductValueCapCents: 30_000,
  currency: "AUD",
  heading: "Show us what you’re making.",
  heroBody:
    "We’re looking for Australian creators who spend their time on fitness, everyday health or biohacking. Send us a link to your work and an idea for a first collaboration.",
  practical: "For creators based in Australia, aged 18 or over.",
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
  { value: "", label: "Share during fit review" },
  { value: "under-1k", label: "Under 1k" },
  { value: "1k-10k", label: "1k-10k" },
  { value: "10k-50k", label: "10k-50k" },
  { value: "50k-plus", label: "50k+" },
];

export const creatorAssets = {
  "cover": {
    "src": "/images/creators/candid-cover-1200.webp",
    "width": 1200,
    "height": 800,
    "alt": "Fictional adult creators taking a break around a camera table in a studio.",
    "objectPosition": "50% 45%",
    "synthetic": true,
    "publicationStatus": "concept",
    "master": "docs/creator-program/assets/editorial-refresh/cover.png",
    "bytes": 80626
  },
  "fitness": {
    "src": "/images/creators/candid-fitness-800.webp",
    "width": 800,
    "height": 1200,
    "alt": "Fictional fitness creator checking her camera between takes in a gym.",
    "objectPosition": "50% 45%",
    "synthetic": true,
    "publicationStatus": "concept",
    "master": "docs/creator-program/assets/editorial-refresh/fitness.png",
    "bytes": 76794
  },
  "health": {
    "src": "/images/creators/candid-health-800.webp",
    "width": 800,
    "height": 1200,
    "alt": "Fictional everyday health creator chatting at her kitchen table.",
    "objectPosition": "50% 40%",
    "synthetic": true,
    "publicationStatus": "concept",
    "master": "docs/creator-program/assets/editorial-refresh/health.png",
    "bytes": 67266
  },
  "biohacker": {
    "src": "/images/creators/candid-biohacker-800.webp",
    "width": 800,
    "height": 1200,
    "alt": "Fictional biohacking creator listening to audio and reviewing notes at his desk.",
    "objectPosition": "50% 45%",
    "synthetic": true,
    "publicationStatus": "concept",
    "master": "docs/creator-program/assets/editorial-refresh/biohacker.png",
    "bytes": 84796
  }
} as const;

export const creatorCategoryPanels = [
  {
    shape: "arch",
    title: "Fitness",
    copy: "Maybe you film between sets, coach a local crew or keep a training diary. We’d like to see what people come back to you for.",
    asset: creatorAssets.fitness,
  },
  {
    shape: "pebble",
    title: "Everyday health",
    copy: "You’ve built an account around everyday habits and honest conversations about health. We’d like to know who’s following along, and what they ask you about.",
    asset: creatorAssets.health,
  },
  {
    shape: "cutout",
    title: "Biohacking",
    copy: "You read past the headline and check where a claim came from. Your audience follows along because you give them something to think about.",
    asset: creatorAssets.biohacker,
  },
] as const;

export const creatorStages = [
  {
    title: "Before anything goes out",
    copy: "Send us your profile and an idea for the collaboration. We’ll look at your work and ask for recent audience insights. If you’re selected, we’ll agree the products, posting brief and content rights before sending your first vial.",
  },
  {
    title: "Your first three posts",
    copy: "Once the product arrives, publish at least three original posts to your audience, following the brief. Send us the live links and available insights. Finish the agreed work and we’ll send a second vial from the eligible range, chosen by you. That reward doesn’t depend on sales, views or a positive review.",
  },
  {
    title: "If we keep working together",
    copy: "After reviewing the collaboration, we may invite you to a referral partnership with a discount for your audience, commission on eligible orders and ongoing product supplies. We’ll agree the terms with you first; this stage isn’t automatic.",
  },
] as const;

export const creatorFaqs = [
  {
    question: "Do I need a large following?",
    answer:
      "We look at who follows you and how they respond, as well as the number. A smaller account can be a good fit when its audience is interested and relevant. We’ll ask for recent platform insights before deciding; a follower count on its own doesn’t tell us enough.",
  },
  {
    question: "Is there an upfront cash payment?",
    answer:
      "No. You receive an eligible peptide worth up to A$300, then a second vial after completing at least three agreed posts. Both are product rewards. Commission is only available later if we invite you to a referral partnership and agree the terms.",
  },
  {
    question: "Can I choose my products?",
    answer:
      "Yes, from the eligible range. Your first choice can be worth up to A$300. We’ll confirm both products, availability and any allowance for the second vial in your brief before you commit. Product rewards can’t be exchanged for cash.",
  },
  {
    question: "What counts towards the three posts?",
    answer:
      "Three or more original pieces you publish to your own audience after the first product arrives. We’ll agree the formats, timing, content scope and disclosures in the brief. Reposts, the same piece on another channel and Stories don’t automatically count as separate posts. We’ll also need the live links and available platform insights.",
  },
  {
    question: "Does my second vial depend on sales or views?",
    answer:
      "No. Complete the agreed brief, including disclosures and reporting, and you earn the second vial. There’s no sales target, views target or requirement for a positive review attached to that reward. Results matter separately when we consider a referral invitation.",
  },
  {
    question: "What audience insights will you ask for?",
    answer:
      "Recent organic views or reach, audience location and age breakdown, plus watch time and engagement where your platform provides them. We’re interested in your usual results over several posts. Bought engagement and undisclosed paid boosts don’t count as organic reach, and one viral post doesn’t show consistency.",
  },
  {
    question: "Do I have to buy or use a product?",
    answer:
      "No. You don’t need to buy anything, use a product or give a positive endorsement. Your brief explains the permitted content and product scope. Personal-use demonstrations, dosing advice and health-result claims aren’t part of the program.",
  },
  {
    question: "Who owns the content?",
    answer:
      "You do. If we’d like to repost your work, the brief will say where and for how long. Paid ads, access to your account, exclusivity and extended use each need a separate agreement. Sending you product doesn’t give us unlimited rights to your work or likeness.",
  },
  {
    question: "How do commission and audience discounts work?",
    answer:
      "We invite creators after reviewing the first collaboration. If you’re invited, we’ll put the commission rate, audience discount, eligible orders, attribution, refunds and payment dates in writing before anything starts. Applying or finishing three posts doesn’t automatically enrol you.",
  },
  {
    question: "Will I keep receiving gifts and supplies?",
    answer:
      "If we agree an ongoing partnership, your plan will cover which products you receive, how often and what content you’ll make. We’ll review that arrangement together. The first collaboration doesn’t come with a promise of unlimited or lifetime supply.",
  },
  {
    question: "Do I need to disclose product rewards?",
    answer:
      "Yes. Products received in exchange for posts and referral commissions are commercial incentives. Each post needs a clear advertising disclosure and the platform’s partnership tools where available. We’ll spell out the requirements in your brief.",
  },
  {
    question: "Does applying guarantee a place?",
    answer:
      "No. We review your content, audience and recent reach against what the program needs and how many collaborations we can support. We’ll confirm your place and agree a brief before sending product. A referral partnership requires a separate invitation.",
  },
  {
    question: "Can I apply from outside Australia?",
    answer: "For now, the program is open to creators based in Australia who are 18 or over.",
  },
] as const;
