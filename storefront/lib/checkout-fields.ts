/** Names match persistent checkout controls, in their visual focus order. */
export const CHECKOUT_FIELDS = ['email','name','street','unit','suburb','state','postcode','phone','instructions','discount','payment','shipping'] as const;
export type CheckoutField = typeof CHECKOUT_FIELDS[number];
export type CheckoutFieldErrors = Partial<Record<CheckoutField,string>>;
export function checkoutFieldErrors(input: {email?:unknown;name?:unknown;address?:{line1?:unknown;line2?:unknown;suburb?:unknown;state?:unknown;postcode?:unknown;country?:unknown;phone?:unknown};deliveryInstructions?:unknown;discountCode?:unknown}):CheckoutFieldErrors {
 const errors:CheckoutFieldErrors={};
 const bounded=(v:unknown,max:number,required=true):v is string=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
 const a=input?.address;
 if(!bounded(input?.email,254)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))errors.email='Enter a valid email address.';
 if(!bounded(input?.name,150))errors.name='Enter your full name (up to 150 characters).';
 if(!bounded(a?.line1,200))errors.street='Enter your street address.';
 if(a?.line2!==undefined&&!bounded(a.line2,200,false))errors.unit='Use up to 200 characters.';
 if(!bounded(a?.suburb,100))errors.suburb='Enter your suburb.';
 if(!bounded(a?.state,3)||!['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].includes(a.state.trim().toUpperCase()))errors.state='Select an Australian state or territory.';
 if(!bounded(a?.postcode,4)||!/^\d{4}$/.test(a.postcode))errors.postcode='Enter a valid 4-digit postcode.';
 if(a?.country!==undefined&&(!bounded(a.country,2)||a.country.toUpperCase()!=='AU'))errors.state='We currently ship within Australia.';
 if(a?.phone!==undefined&&!bounded(a.phone,30,false))errors.phone='Use up to 30 characters.';
 if(input?.deliveryInstructions!==undefined&&!bounded(input.deliveryInstructions,500,false))errors.instructions='Use up to 500 characters.';
 if(input?.discountCode!==undefined&&!bounded(input.discountCode,50,false))errors.discount='Enter a valid discount code.';
 return errors;
}
