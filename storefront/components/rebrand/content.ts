/** Legacy image/query values remain readable for existing product bookmarks. */
export type RebrandVariant = "v1" | "v2" | "v3";

export const directions = {
  v2: {
    name: "Research peptides you can trust",
    heading: "Research Peptides You Can Trust. Quality You Can Verify",
    rangeTitle: "Explore the peptide range.",
    proofTitle: "Read the reports for yourself.",
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
