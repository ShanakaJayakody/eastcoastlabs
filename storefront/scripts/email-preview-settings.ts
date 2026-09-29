/** Local preview data only. Never call the real settings getter or database. */
import { DEFAULT_SETTINGS } from '../lib/settings';

export async function getSettings() {
  return {
    ...DEFAULT_SETTINGS,
    supportEmail: 'preview-support@example.test',
    payidIdentifier: 'preview-payments@example.test',
    payidName: 'East Coast Labs (sample)',
    bankBsb: '000-000',
    bankAccountNumber: '00000000',
    bankAccountName: 'East Coast Labs (sample)',
  };
}
