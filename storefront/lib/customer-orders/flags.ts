import 'server-only';
export const customerAccountsEnabled=()=>process.env.CUSTOMER_ACCOUNTS_ENABLED==='1';
export const customerOrderEmailsEnabled=()=>process.env.CUSTOMER_ORDER_EMAILS_ENABLED==='1';
export const customerOrdersEnabled=()=>process.env.CUSTOMER_ORDERS_ENABLED==='1';
