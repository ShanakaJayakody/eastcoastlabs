import type { Audience, Discipline, Focus, Region } from "./types";

export const CREATOR_PRIVACY_VERSION = "creator-privacy-2026-09-09-v2";

export const creatorCopy = {
  name: "ECL Creator Collective",
  route: "/creators",
  cta: "Apply to the collective",
  applicationAnchor: "#apply",
  firstProductValueCapCents: 30_000,
  currency: "AUD",
  heading: ["Your influence.", "Our next chapter."],
  heroBody:
    "Build a partnership with East Coast Labs, one stage at a time. Start with product rewards, share in your own voice, and grow towards commission and ongoing support.",
  practical: "Australia · 18+ · By application · Product rewards first",
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

export const creatorStages = [
  {
    index: "01",
    title: "Find our fit.",
    copy: "Apply with your profile, audience size and recent reach. We review your content, audience relevance and evidence of qualified views. If selected, choose an eligible peptide valued up to A$300. We agree your brief before sending it.",
  },
  {
    index: "02",
    title: "Create. Share. Be rewarded.",
    copy: "Once your first product arrives, publish a minimum of three original posts, Reels or TikToks to your audience under the agreed brief. Share the live links and post insights. Complete the agreed deliverables and we send a second vial of your choice from the eligible range.",
  },
  {
    index: "03",
    title: "Grow with the collective.",
    copy: "We review your reach, engagement and the interest your content creates. Successful creators are invited to a referral partnership: an audience discount, commission on eligible referred orders, and ongoing gifts and product supplies under an agreed partner plan.",
  },
] as const;

export const creatorFaqs = [
  {
    question: "Do I need a large following?",
    answer:
      "Audience size is part of our review, alongside recent organic reach, audience relevance and meaningful engagement. A smaller, engaged community can be a strong fit. We ask for platform insights before confirming selection; follower count alone does not qualify an application.",
  },
  {
    question: "Is there an upfront cash payment?",
    answer:
      "No. The first collaboration is compensated with products: an eligible peptide of your choice valued up to A$300, followed by a second vial after you complete the agreed minimum of three posts. Cash commission becomes available only if you are invited to the referral stage and agree its terms.",
  },
  {
    question: "Can I choose my products?",
    answer:
      "Yes. Selected creators choose their first peptide from the eligible range, up to A$300 in product value. Your second vial is also your choice from the eligible range. We confirm both selections, the second-vial allowance and availability in your brief before you begin. Product rewards are not redeemable for cash.",
  },
  {
    question: "What counts towards the three posts?",
    answer:
      "At least three original pieces published to your own audience after your first product arrives. We agree formats, channels, timing, disclosures and content scope in advance. Reposts, duplicate cross-posts and Stories do not automatically count as separate deliverables. Share the live links and available platform insights so we can review the collaboration.",
  },
  {
    question: "Does my second vial depend on sales or views?",
    answer:
      "No. Your second vial rewards completion of the agreed posting brief, including its disclosures and reporting. It is not conditional on hitting a sales or views target, or on giving a positive review. Performance is assessed separately when we consider an ongoing referral partnership.",
  },
  {
    question: "What are qualified views?",
    answer:
      "We look for real, organic attention from an audience relevant to the agreed brief. We review platform-reported reach or views alongside audience location, age breakdown, watch time where available, and meaningful engagement. Bought engagement, undisclosed paid boosts and a single viral outlier do not demonstrate consistent reach.",
  },
  {
    question: "Do I have to buy or use a product?",
    answer:
      "No purchase or personal use is required. Participation does not require a positive endorsement. Each brief sets out the permitted content and product scope; personal-use demonstrations, dosing advice and health-result claims are not part of this program.",
  },
  {
    question: "Who owns the content?",
    answer:
      "You retain ownership. Your brief sets out any agreed ECL reposting licence, channels and duration. Paid advertising, account permissions, exclusivity and extended use require a separate agreement. Product rewards do not give ECL unlimited rights to your content or likeness.",
  },
  {
    question: "How do commission and audience discounts work?",
    answer:
      "After a successful first collaboration and performance review, invited creators receive a referral arrangement with an audience discount and commission on eligible referred orders. Rates, eligible products, attribution, refunds and payment timing are agreed in writing before activation. Applying or completing three posts does not automatically activate commission.",
  },
  {
    question: "Will I keep receiving gifts and supplies?",
    answer:
      "Ongoing partners receive gifts and product supplies as part of an agreed partner plan. We review the relationship regularly and agree the product selection, frequency and content commitments together. The first collaboration does not promise unlimited or lifetime supply.",
  },
  {
    question: "Do I need to disclose product rewards?",
    answer:
      "Yes. Product rewards and referral commissions are commercial incentives. Each post must clearly disclose the relationship using the agreed advertising disclosure and the platform's partnership tools where available. Your brief explains what is required; you always keep your own honest voice.",
  },
  {
    question: "Does applying guarantee a place?",
    answer:
      "No. We review each application for audience fit, demonstrated reach, content quality and program capacity. We confirm selection and agree the brief before supplying any product. Progression to the referral stage is a separate invitation.",
  },
  {
    question: "Can I apply from outside Australia?",
    answer: "The initial program is for Australia-based creators aged 18 or over.",
  },
] as const;
