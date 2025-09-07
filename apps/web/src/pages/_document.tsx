import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        {/* USWDS Icon Sprites */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Preload critical USWDS assets */}
        <link rel="preload" href="/fonts/public-sans-v14-latin-regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        
        {/* USWDS Icon sprite for consistent icons */}
        <script defer src="https://use.fontawesome.com/releases/v5.15.4/js/all.js"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}