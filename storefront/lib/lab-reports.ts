export interface LabReport {
  taskNumber: string;
  compound: string;
  productSlug: string;
  sample: string;
  batch: string | null;
  client: string;
  manufacturer: string;
  testDate: string;
  purityPct: number[];
  measurements: { analyte: string; mg: number[] }[];
  verificationKey: string;
  verificationUrl: string;
  image: string;
}

/** Owner-supplied historical reports, transcribed from the unchanged image files.
 * These are NOT current inventory/lot certificates. Never merge into getAllCoa,
 * shipping slips, current-batch claims, or the operator-verified database feed.
 * Verification URLs were decoded from the originals' QR codes. */
export const labReports: LabReport[] = [
  {
    taskNumber: "94947",
    compound: "GLOW",
    productSlug: "glow",
    sample: "Glow 70(Green cap)",
    batch: "2025123170",
    client: "G",
    manufacturer: "G",
    testDate: "2025-12-22",
    purityPct: [],
    measurements: [
      {
        analyte: "GHK-Cu",
        mg: [64.31, 62.36, 64.35],
      },
      {
        analyte: "TB-500 (TB4)",
        mg: [10.99, 10.79, 11.2],
      },
      {
        analyte: "BPC-157",
        mg: [12.67, 12.27, 12.78],
      },
    ],
    verificationKey: "LAURNQZSJ1DL",
    verificationUrl: "https://www.janoshik.com/tests/94947_LAURNQZSJ1DL",
    image: "/lab-reports/glow-94947.png",
  },
  {
    taskNumber: "94556",
    compound: "Retatrutide",
    productSlug: "retatrutide",
    sample: "Retatrutide 10 (White cap)",
    batch: "2025121210",
    client: "G",
    manufacturer: "G",
    testDate: "2025-12-19",
    purityPct: [99.538, 99.661, 99.539],
    measurements: [
      {
        analyte: "Retatrutide",
        mg: [10.57, 10.46, 10.22],
      },
    ],
    verificationKey: "RPDUXJ5MV768",
    verificationUrl: "https://www.janoshik.com/tests/94556_RPDUXJ5MV768",
    image: "/lab-reports/retatrutide-94556.png",
  },
  {
    taskNumber: "92380",
    compound: "KLOW",
    productSlug: "klow",
    sample: "Klow 80mg(Pink)",
    batch: "2025126380",
    client: "G",
    manufacturer: "G",
    testDate: "2025-12-09",
    purityPct: [],
    measurements: [
      {
        analyte: "GHK-Cu",
        mg: [66.89, 66.65, 63.92],
      },
      {
        analyte: "BPC-157",
        mg: [13.23, 13.48, 12.92],
      },
      {
        analyte: "TB-500 (TB4)",
        mg: [11.91, 11.99, 11.51],
      },
      {
        analyte: "KPV",
        mg: [5.77, 5.76, 5.53],
      },
    ],
    verificationKey: "Y8S16NDALBLM",
    verificationUrl: "https://www.janoshik.com/tests/92380_Y8S16NDALBLM",
    image: "/lab-reports/klow-92380.png",
  },
  {
    taskNumber: "91237",
    compound: "MOTS-C",
    productSlug: "mots-c",
    sample: "MOTS-C 10mg",
    batch: null,
    client: "Sin City Science",
    manufacturer: "JEC/JCE",
    testDate: "2025-12-03",
    purityPct: [99.535],
    measurements: [
      {
        analyte: "MOTS-C",
        mg: [11.09],
      },
    ],
    verificationKey: "X4DD6NX7PHWZ",
    verificationUrl: "https://www.janoshik.com/tests/91237_X4DD6NX7PHWZ",
    image: "/lab-reports/mots-c-91237.jpg",
  },
  {
    taskNumber: "91217",
    compound: "Selank",
    productSlug: "selank",
    sample: "Selank 10mg",
    batch: null,
    client: "Sin City Science",
    manufacturer: "JEC/JCE",
    testDate: "2025-12-03",
    purityPct: [99.563],
    measurements: [
      {
        analyte: "Selank",
        mg: [12.44],
      },
    ],
    verificationKey: "E7EJHVC78LB5",
    verificationUrl: "https://www.janoshik.com/tests/91217_E7EJHVC78LB5",
    image: "/lab-reports/selank-91217.jpg",
  },
  {
    taskNumber: "91216",
    compound: "Semax",
    productSlug: "semax",
    sample: "Semax 10mg",
    batch: null,
    client: "Sin City Science",
    manufacturer: "JEC/JCE",
    testDate: "2025-12-03",
    purityPct: [99.181],
    measurements: [
      {
        analyte: "Semax",
        mg: [11.24],
      },
    ],
    verificationKey: "VF6P3LJFQUEZ",
    verificationUrl: "https://www.janoshik.com/tests/91216_VF6P3LJFQUEZ",
    image: "/lab-reports/semax-91216.jpg",
  },
  {
    taskNumber: "89939",
    compound: "Tesamorelin",
    productSlug: "tesamorelin",
    sample: "Tesamorelin 10mg(Purple cap)",
    batch: "2025112110",
    client: "G",
    manufacturer: "G",
    testDate: "2025-11-25",
    purityPct: [99.616, 99.595, 99.515],
    measurements: [
      {
        analyte: "Tesamorelin",
        mg: [11.83, 11.36, 11.5],
      },
    ],
    verificationKey: "WQXIG9HIC3PW",
    verificationUrl: "https://www.janoshik.com/tests/89939_WQXIG9HIC3PW",
    image: "/lab-reports/tesamorelin-89939.png",
  },
  {
    taskNumber: "89714",
    compound: "TB-500",
    productSlug: "tb-500",
    sample: "TB 10mg(Blue cap)",
    batch: "2025111510",
    client: "G",
    manufacturer: "G",
    testDate: "2025-11-21",
    purityPct: [99.485, 99.387, 99.42],
    measurements: [
      {
        analyte: "TB-500 (TB4)",
        mg: [10.49, 11.33, 11.34],
      },
    ],
    verificationKey: "KECK9GI7TZ5X",
    verificationUrl: "https://www.janoshik.com/tests/89714_KECK9GI7TZ5X",
    image: "/lab-reports/tb-500-89714.png",
  },
  {
    taskNumber: "74164",
    compound: "BPC-157",
    productSlug: "bpc-157",
    sample: "BP-10mg(Yellow cap)",
    batch: "G2025081610",
    client: "G",
    manufacturer: "G",
    testDate: "2025-08-12",
    purityPct: [99.76, 99.633, 99.642],
    measurements: [
      {
        analyte: "BPC-157",
        mg: [14.76, 14.83, 14.85],
      },
    ],
    verificationKey: "9VXND1JZ74Q3",
    verificationUrl: "https://www.janoshik.com/tests/74164_9VXND1JZ74Q3",
    image: "/lab-reports/bpc-157-74164.png",
  },
  {
    taskNumber: "66282",
    compound: "Semaglutide",
    productSlug: "semaglutide",
    sample: "Semaglutide 10mg(Azure cap)",
    batch: "G20250533",
    client: "G",
    manufacturer: "G",
    testDate: "2025-05-27",
    purityPct: [99.622, 99.721, 99.645],
    measurements: [
      {
        analyte: "Semaglutide",
        mg: [11.69, 11.78, 11.23],
      },
    ],
    verificationKey: "9PMWPI5RT8YB",
    verificationUrl: "https://www.janoshik.com/tests/66282_9PMWPI5RT8YB",
    image: "/lab-reports/semaglutide-66282.png",
  },
  {
    taskNumber: "65360",
    compound: "Tirzepatide",
    productSlug: "tirzepatide",
    sample: "Tirzepatide 10mg(green)",
    batch: "G20250598",
    client: "G",
    manufacturer: "G",
    testDate: "2025-05-19",
    purityPct: [99.336, 99.367, 99.246],
    measurements: [
      {
        analyte: "Tirzepatide",
        mg: [10.76, 10.64, 10.6],
      },
    ],
    verificationKey: "2PMVUXWI3JLP",
    verificationUrl: "https://www.janoshik.com/tests/65360_2PMVUXWI3JLP",
    image: "/lab-reports/tirzepatide-65360.png",
  },
  {
    taskNumber: "60548",
    compound: "IGF-1 LR3",
    productSlug: "igf",
    sample: "IGF-1 LR3 1mg(Red cap)",
    batch: "G2025035501",
    client: "G",
    manufacturer: "G",
    testDate: "2025-03-25",
    purityPct: [99.515, 99.697, 99.717],
    measurements: [
      {
        analyte: "IGF-1 LR3",
        mg: [1.28, 1.23, 1.31],
      },
    ],
    verificationKey: "EYPJRL1EB2ZQ",
    verificationUrl: "https://www.janoshik.com/tests/60548_EYPJRL1EB2ZQ",
    image: "/lab-reports/igf-60548.png",
  },
  {
    taskNumber: "56427",
    compound: "MT2",
    productSlug: "mt2",
    sample: "Melanotan-2 10mg(Blue cap)",
    batch: "G2025012410",
    client: "G",
    manufacturer: "G",
    testDate: "2025-01-24",
    purityPct: [99.337, 99.343, 99.38],
    measurements: [
      {
        analyte: "Melanotan 2",
        mg: [11.23, 11.24, 11.48],
      },
    ],
    verificationKey: "91XCKJYRNH5K",
    verificationUrl: "https://www.janoshik.com/tests/56427_91XCKJYRNH5K",
    image: "/lab-reports/mt2-56427.png",
  },
  {
    taskNumber: "51162",
    compound: "GHK-Cu",
    productSlug: "ghk-cu",
    sample: "GHK-Cu 50mg {Silver Cap}",
    batch: "G202411G",
    client: "G",
    manufacturer: "G",
    testDate: "2024-10-24",
    purityPct: [99.881],
    measurements: [
      {
        analyte: "GHK-Cu",
        mg: [54.1],
      },
    ],
    verificationKey: "U7ARMND4D1LH",
    verificationUrl: "https://www.janoshik.com/tests/51162_U7ARMND4D1LH",
    image: "/lab-reports/ghk-cu-51162.png",
  },
];
