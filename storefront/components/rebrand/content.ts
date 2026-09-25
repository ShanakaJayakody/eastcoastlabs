export type RebrandVariant = "v1" | "v2" | "v3";

export const directions = {
  v1: {
    name: "Know what you’re buying",
    eyebrow: "Research peptides from Australia",
    heading: "You should know",
    emphasis: "what you’re buying.",
    intro:
      "Buying from a new supplier takes trust. We put the product details and original supplier lab reports here for you to check. If something’s missing, ask us before you order.",
    primary: "View the products",
    secondary: "Read the lab reports",
    rangeTitle: "Find the product you came for",
    proofTitle: "Here’s what you can check",
    aboutTitle: "It’s worth asking before you buy",
    aboutCopy:
      "You might be comparing suppliers, checking a report or working out which size is listed. Send us the product name and your question. You don’t need to know the technical terms to ask.",
  },
  v2: {
    name: "Check the report",
    eyebrow: "East Coast Labs · Research supply",
    heading: "What did the lab",
    emphasis: "actually find?",
    intro:
      "Read the original supplier reports, including the tested sample, date and result. Follow the laboratory’s verification link, then ask us whether a report covers the batch you’re considering.",
    primary: "Open the lab reports",
    secondary: "View the products",
    rangeTitle: "Research peptides and current prices",
    proofTitle: "Read the full report",
    aboutTitle: "Need help checking a detail?",
    aboutCopy:
      "Tell us the product name and what you’re trying to confirm. If you’re looking at a report, include its number or link so we can look at the same document.",
  },
  v3: {
    name: "Ask us before you order",
    eyebrow: "An Australian research supplier",
    heading: "You can ask us",
    emphasis: "before you order.",
    intro:
      "There’s a lot to check when you’re comparing peptide suppliers. If a product label or a lab report leaves you with a question, email us. You don’t have to place an order to get in touch.",
    primary: "Email your question",
    secondary: "See the products",
    rangeTitle: "Take a look at the range",
    proofTitle: "The reports are here for you to read",
    aboutTitle: "Some questions need more than a product page",
    aboutCopy:
      "If you’re here because your health priorities have changed after breastfeeding or around menopause, your questions deserve care. We can explain our product documentation. A qualified clinician who knows your health history is the right person to discuss treatment with.",
  },
} as const;

export const questions = [
  {
    q: "Where are the lab reports?",
    a: "You’ll find the original supplier reports in our lab-results library, alongside any published batch documents. Look for the product name, test date and sample or batch number. If you can’t find the report you need, email us with the product name.",
  },
  {
    q: "Does a high purity result tell me everything?",
    a: "No. It tells you about the sample and test described in that report. It doesn’t establish sterility, medical safety or effectiveness, and it isn’t a result for every batch. The full report matters more than a percentage on its own.",
  },
  {
    q: "Can I use these products myself?",
    a: "No. We supply laboratory research materials, not products for human or animal use. We don’t provide advice on weight loss, post-pregnancy recovery, menopause treatment or dosing. Please take personal health questions to a qualified healthcare professional.",
  },
  {
    q: "How do I check the batch I’ll receive?",
    a: "Contact us before you order with the product name and the report you’re looking at. Ask which batch is available and which documents apply to it. An older supplier report alone doesn’t confirm the batch that will be sent to you.",
  },
];
