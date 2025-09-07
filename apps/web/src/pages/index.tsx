import Head from 'next/head';
import { GetStaticPropsContext } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export default function Home() {
  const t = useTranslations();

  const features = [
    {
      title: t('home.features.multilingual.title'),
      description: t('home.features.multilingual.description'),
      icon: '🌍'
    },
    {
      title: t('home.features.smartForms.title'),
      description: t('home.features.smartForms.description'),
      icon: '📄'
    },
    {
      title: t('home.features.secure.title'),
      description: t('home.features.secure.description'),
      icon: '🔒'
    }
  ];

  return (
    <>
      <Head>
        <title>{t('home.title')}</title>
        <meta name="description" content={t('home.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Hero Section */}
      <section className="usa-hero" aria-label={t('home.title')}>
        <div className="grid-container">
          <div className="usa-hero__callout">
            <h1 className="usa-hero__heading">
              <span className="usa-hero__heading--alt">{t('home.title')}</span>
              {t('home.subtitle')}
            </h1>
            <p className="usa-hero__description">
              {t('home.description')}
            </p>
            <a className="usa-button usa-button--big" href="/forms">
              {t('home.getStarted')}
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="usa-section">
        <div className="grid-container">
          <h2 className="font-heading-xl margin-top-0 tablet:margin-bottom-4">
            Key Features
          </h2>
          <div className="grid-row grid-gap">
            {features.map((feature, index) => (
              <div key={index} className="tablet:grid-col-4">
                <div className="immigration-card">
                  <div className="text-center">
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="font-heading-lg margin-top-0">
                      {feature.title}
                    </h3>
                    <p className="margin-bottom-0">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Status Section */}
      <section className="usa-section usa-section--light">
        <div className="grid-container">
          <div className="grid-row">
            <div className="grid-col-12 tablet:grid-col-8">
              <h2 className="font-heading-xl margin-top-0">
                Module 1 Complete! 🎉
              </h2>
              <div className="bg-success-lighter padding-2 border-left-05 border-success margin-y-2">
                <h3 className="text-success margin-top-0">
                  ✅ Multilingual Support Ready
                </h3>
                <ul className="usa-list margin-bottom-0">
                  <li><strong>Languages:</strong> English, Spanish, French, Arabic</li>
                  <li><strong>RTL Support:</strong> Full right-to-left layout for Arabic</li>
                  <li><strong>USWDS Styling:</strong> Government-standard design system</li>
                  <li><strong>Responsive Layout:</strong> Mobile-first design approach</li>
                </ul>
              </div>
            </div>
            <div className="grid-col-12 tablet:grid-col-4">
              <div className="immigration-card bg-primary-lighter">
                <h4 className="text-primary margin-top-0">
                  🚀 Next: Module 2
                </h4>
                <p className="margin-bottom-0">
                  Form.io integration with USWDS theming for dynamic immigration forms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`../messages/${locale || 'en'}.json`)).default
    }
  };
}