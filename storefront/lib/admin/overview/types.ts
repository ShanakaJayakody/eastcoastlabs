export type OverviewRange={kind:'today'|'week'|'month'}|{kind:'custom';from:string;to:string};
export type PaidOrderFact={id:string;paid_at:string;total_cents:number};
export type Interval={from:string;until:string};
export type OverviewWindow={from:string;until:string;previousFrom:string;previousUntil:string;labels:string[];previousLabels:string[];bounds:(Interval|null)[];previousBounds:(Interval|null)[];label:string;comparisonLabel:string;timing:string};
export type RevenueOverviewData={asOf:string;range:OverviewRange;window:OverviewWindow;points:{label:string;previousLabel:string;cents:number|null;previousCents:number|null}[];totalCents:number;previousTotalCents:number;paidOrderCount:number;averageCents:number|null;changePercent:number|null};
