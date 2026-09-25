export type RebrandVariant = "v1" | "v2" | "v3";

export const directions = {
  v1: {
    name: "Research peptides from an Australian supplier",
    eyebrow: "East Coast Labs · Australian owned",
    heading: "Research Peptides You Can Trust. Quality You Can Verify",
    intro:
      "Browse our peptide range, compare vial sizes and prices, and read the supplier lab reports we publish. If you have a question about a product or an order, you’re welcome to get in touch.",
    primary: "View research peptides",
    secondary: "Read the lab reports",
    rangeTitle: "Browse research peptides",
    proofTitle: "Product reports and test details",
    aboutTitle: "Have a question about a product?",
    aboutCopy:
      "You don’t need to know all the technical terms to get in touch. Tell us which peptide you’re looking at and what you’d like to know. We can help with product specifications, the available reports and your order.",
  },
  v2: {
    name: "Research peptides and supplier lab reports",
    eyebrow: "East Coast Labs · Australian owned",
    heading: "Research Peptides You Can Trust. Quality You Can Verify",
    intro:
      "We’re an Australian peptide supplier. Our library brings together the original supplier reports, test dates and laboratory verification links. Each document identifies the sample that was tested.",
    primary: "View research peptides",
    secondary: "Browse lab reports",
    rangeTitle: "Research peptides and current prices",
    proofTitle: "The original reports, in full",
    aboutTitle: "Let’s look at the same document",
    aboutCopy:
      "If a result or a product specification needs explaining, send us the product name and report link. That gives us a useful starting point for answering your question.",
  },
  v3: {
    name: "Your Australian research peptide supplier",
    eyebrow: "East Coast Labs · Australian owned",
    heading: "Research Peptides You Can Trust. Quality You Can Verify",
    intro:
      "You can browse the range, compare sizes and read the available reports here. If you’re unsure about a product detail, send us a question. You’re welcome to contact us before placing an order.",
    primary: "View research peptides",
    secondary: "Ask a product question",
    rangeTitle: "Find your research peptide",
    proofTitle: "Read the reports behind the range",
    aboutTitle: "You’re welcome to ask us first",
    aboutCopy:
      "Whether you’re comparing vial sizes or following up on a delivery, you can email us directly. Include the product name or your order number so we can help with the right details.",
  },
} as const;

export const questions = [
  {
    q: "Where can I find a product’s lab report?",
    a: "Available supplier reports are linked beside the peptides in our range and collected in our lab-results library. The library also includes any published batch documents. Each report shows its sample details and test date; historical supplier reports do not confirm the batch currently available.",
  },
  {
    q: "Does a high purity result tell me everything?",
    a: "A purity result describes the sample and test in that report. It does not establish sterility, medical safety or effectiveness. Read it alongside the sample details, test date and other results in the document.",
  },
  {
    q: "Can I use these products myself?",
    a: "No. Our peptides are supplied for laboratory research only, not for human or animal use. We can help with product documentation and orders. A qualified healthcare professional is the right person to speak to about personal health or treatment.",
  },
  {
    q: "How do I check the batch I’ll receive?",
    a: "Contact us before you order with the product name and the report you’re looking at. Ask which batch is available and which documents apply to it. An older supplier report alone doesn’t confirm the batch that will be sent to you.",
  },
  {
    q: "What happens after I place an order?",
    a: "You’ll receive payment instructions with the exact amount and your order reference. We prepare your order after payment is confirmed. Shipping options and the total are shown at checkout, and tracking details are provided when your shipment is recorded.",
  },
  {
    q: "What if my order arrives damaged or incorrect?",
    a: "Email us with your order reference and a description of the problem. Photos of the item and packaging help us look into it. Keep the packaging and contact us before returning anything; our returns page explains the process.",
  },
];
