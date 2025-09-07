import { NextIntlClientProvider } from 'next-intl';
import { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import '../styles/globals.scss';

type Props = AppProps & {
  pageProps: {
    messages?: any;
  };
};

export default function App({ Component, pageProps }: Props) {
  const router = useRouter();
  
  return (
    <NextIntlClientProvider
      locale={router.locale || 'en'}
      messages={pageProps.messages}
    >
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </NextIntlClientProvider>
  );
}