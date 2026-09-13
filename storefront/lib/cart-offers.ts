import stacks from '@/data/stacks.json';
import { RECON_KIT_SLUG } from './accessories';

type OfferLine = {key:string;slug:string;components?:string[];quantity:number};
const KIT_CONTENTS = ['bacteriostatic-water','insulin-syringes','alcohol-swabs'];

/** Cents on both sides of this boundary; a zero threshold still needs a paid item. */
export function isGiftEligible({subtotalCents,thresholdCents,available,hasPaidItems}:{
  subtotalCents:number;thresholdCents:number;available:number|null;hasPaidItems:boolean;
}):boolean {
  return hasPaidItems && Number.isSafeInteger(subtotalCents) && subtotalCents > 0 &&
    Number.isSafeInteger(thresholdCents) && thresholdCents >= 0 && subtotalCents >= thresholdCents &&
    available !== null && Number.isFinite(available) && available >= 1;
}

function contents(line:OfferLine):string[] {
  const stack=line.key.startsWith('stack:') ? stacks.stacks.find(s=>s.slug===line.slug) : undefined;
  return [line.slug,...(line.components ?? stack?.components ?? []),
    ...(line.slug===RECON_KIT_SLUG ? KIT_CONTENTS : []),
    ...(stack?.freeBacWater ? ['bacteriostatic-water'] : [])];
}

/** Includes stock components of kits/stacks, even after a persisted cart reload. */
export function cartContainsProduct(lines:readonly OfferLine[],slug:string):boolean {
  return lines.some(line=>line.quantity>0 && contents(line).includes(slug));
}

export function accessoryAlreadyIncluded(lines:readonly OfferLine[],slug:string):boolean {
  return cartContainsProduct(lines,slug) ||
    (slug===RECON_KIT_SLUG && KIT_CONTENTS.some(component=>cartContainsProduct(lines,component)));
}
