export type RebrandVariant = "v1" | "v2" | "v3";

export const directions = {
  v1: {
    name: "Considered Care",
    eyebrow: "A more considered approach to research",
    heading: "Clarity comes first.",
    emphasis: "Confidence follows.",
    intro:
      "Thoughtfully sourced research peptides. Open access to original lab reports. An Australian team that makes the details feel simple.",
    primary: "Explore the collection",
    secondary: "Our approach to testing",
    rangeTitle: "A carefully considered collection.",
    proofTitle: "Reassurance, with the evidence to match.",
    aboutTitle: "Life moves forward. So does your curiosity.",
    aboutCopy:
      "Making time for yourself after motherhood. Finding your footing through midlife. Looking ahead with a little more curiosity. We believe women deserve information that is clear, respectful and easy to explore.",
  },
  v2: {
    name: "Clear Science",
    eyebrow: "Australian research supply. Open documentation.",
    heading: "Trust begins",
    emphasis: "with the evidence.",
    intro:
      "A clear view of the compound, the sample and the source. Explore research peptides with original laboratory reports and straightforward product information.",
    primary: "Review the lab reports",
    secondary: "Explore research peptides",
    rangeTitle: "Precision starts with the details.",
    proofTitle: "The source. The sample. The result.",
    aboutTitle: "Better questions deserve clearer answers.",
    aboutCopy:
      "Your time is valuable. Whether you are new to peptide research or reading further, we put the relevant details within reach: product information, original documents and a local point of contact.",
  },
  v3: {
    name: "A New Perspective",
    eyebrow: "For the curious. For the considered.",
    heading: "A fresh perspective.",
    emphasis: "The same high standards.",
    intro:
      "Room for questions. Space to understand. Discover a more thoughtful research brand, grounded in transparency and a distinctly human approach.",
    primary: "Meet your next discovery",
    secondary: "Look at the evidence",
    rangeTitle: "Follow your curiosity.",
    proofTitle: "Thoughtful by nature. Transparent by choice.",
    aboutTitle: "Every chapter brings new questions.",
    aboutCopy:
      "From life after breastfeeding to perimenopause, menopause and the years beyond, women deserve to feel seen in the conversations that matter to them. Our approach begins with listening, clear language and respect for your questions.",
  },
} as const;

export const questions = [
  {
    q: "Where can I see your testing documents?",
    a: "Our lab-results library contains original supplier reports and any published, verified batch documents. Check the compound, sample, date and batch reference on the original document. Historical supplier reports do not establish which lot will be shipped with a current order.",
  },
  {
    q: "What does a purity result tell me?",
    a: "A purity result describes the sample tested using the method in the report. It does not, by itself, establish sterility, clinical effectiveness, safety for personal use or the quality of every batch. Read the complete document for its scope.",
  },
  {
    q: "Are these products intended for personal use?",
    a: "No. Our products are supplied for laboratory research only and are not for human or animal consumption. The collection is not a weight-management, postpartum or menopause treatment programme. Personal health questions belong with a qualified healthcare professional.",
  },
  {
    q: "How can I check a product or batch before ordering?",
    a: "Start with the product page for current sizes, availability and pricing, then check the relevant lab documentation. If a report or batch reference is missing or unclear, contact our Australian team before placing an order.",
  },
];
