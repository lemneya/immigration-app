import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Supported locales
export const locales = ['en', 'es', 'fr', 'ar'] as const;
export type Locale = typeof locales[number];

// RTL locales
export const rtlLocales: Locale[] = ['ar'];

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
    // Configure time zone and formats
    timeZone: 'America/New_York',
    // Handle RTL
    direction: rtlLocales.includes(locale as Locale) ? 'rtl' : 'ltr'
  };
});