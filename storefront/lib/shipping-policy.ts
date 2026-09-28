import type { StoreSettings } from './settings';
import { formatAud } from './format';

export interface ShippingRule {
  method: 'standard' | 'express';
  label: string;
  rateCents: number;
  freeThresholdCents: number;
  eta: string;
}

type ShippingSettings = Pick<StoreSettings, 'standardShippingCents' | 'freeShippingThreshold' | 'expressShippingEnabled' | 'expressShippingCents' | 'expressFreeThreshold'>;

/** Public rules shared by quotes, policy copy and the cart. No payment credentials. */
export function shippingRules(settings: ShippingSettings): ShippingRule[] {
  const rule = (method: ShippingRule['method'], rateCents: number, threshold: number, eta: string): ShippingRule => ({
    method, label: method === 'standard' ? 'Standard shipping' : 'Express shipping', rateCents,
    freeThresholdCents: rateCents === 0 ? 0 : Math.max(0, Math.round(threshold * 100)), eta,
  });
  return [
    rule('standard', settings.standardShippingCents, settings.freeShippingThreshold, '2–5 business days'),
    ...(settings.expressShippingEnabled ? [rule('express', settings.expressShippingCents, settings.expressFreeThreshold, '1–2 business days')] : []),
  ];
}

export function shippingSummary(rule: ShippingRule): string {
  return rule.freeThresholdCents === 0
    ? `${rule.label} included`
    : `${rule.label} ${formatAud(rule.rateCents / 100)} · free from ${formatAud(rule.freeThresholdCents / 100)}`;
}

export function shippingAnnouncement(rules: ShippingRule[]): string {
  return rules.map(rule => rule.freeThresholdCents === 0
    ? `${rule.method === 'standard' ? 'Standard' : 'Express'} shipping included`
    : `Free ${rule.method} ${formatAud(rule.freeThresholdCents / 100, rule.freeThresholdCents % 100 ? 2 : 0)}+`).join(' · ');
}
