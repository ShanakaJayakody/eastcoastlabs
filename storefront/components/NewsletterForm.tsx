'use client';

import dynamic from 'next/dynamic';

// Keep the reusable form in one shared chunk across both homepage footers.
// Default SSR preserves the form in the initial HTML.
const NewsletterForm = dynamic(() => import('./EmailCapture'));

export default NewsletterForm;
