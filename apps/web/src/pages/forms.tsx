import Head from 'next/head';
import Link from 'next/link';
import { GetStaticPropsContext } from 'next';
import { useTranslations } from 'next-intl';

const availableForms = [
  {
    id: 'i485',
    title: 'Form I-485',
    description: 'Application to Adjust Status to Permanent Resident',
    icon: '📝',
    estimatedTime: '45-60 minutes',
    difficulty: 'Medium',
    category: 'Green Card'
  },
  {
    id: 'i130', 
    title: 'Form I-130',
    description: 'Petition for Alien Relative',
    icon: '👪',
    estimatedTime: '30-45 minutes',
    difficulty: 'Easy',
    category: 'Family'
  }
];

export default function FormsPage() {
  const t = useTranslations();

  return (
    <>
      <Head>
        <title>{t('forms.title')} - {t('home.title')}</title>
        <meta name="description" content={t('forms.selectForm')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Page Header */}
      <section className="usa-section usa-section--dark bg-primary-darker">
        <div className="grid-container">
          <div className="grid-row">
            <div className="grid-col-12">
              <h1 className="font-heading-2xl margin-y-0 text-white">
                {t('forms.title')}
              </h1>
              <p className="font-body-lg text-primary-lighter margin-bottom-0 margin-top-1">
                {t('forms.selectForm')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Forms Grid */}
      <section className="usa-section">
        <div className="grid-container">
          <div className="grid-row grid-gap">
            {availableForms.map((form) => (
              <div key={form.id} className="tablet:grid-col-6">
                <div className="immigration-card">
                  <div className="display-flex flex-align-start margin-bottom-2">
                    <div className="text-4xl margin-right-2">{form.icon}</div>
                    <div className="flex-fill">
                      <h2 className="font-heading-lg margin-top-0 margin-bottom-1">
                        {t(`forms.${form.id}.title`)}
                      </h2>
                      <p className="margin-bottom-1 text-base-dark">
                        {t(`forms.${form.id}.description`)}
                      </p>
                    </div>
                  </div>

                  {/* Form Metadata */}
                  <div className="margin-bottom-2">
                    <div className="display-flex flex-wrap margin-top-1">
                      <span className="usa-tag usa-tag--big margin-right-1 margin-bottom-1">
                        {form.category}
                      </span>
                      <span className="usa-tag usa-tag--big bg-accent-cool-lighter text-ink margin-right-1 margin-bottom-1">
                        {form.difficulty}
                      </span>
                    </div>
                    <p className="text-base-dark margin-top-1 margin-bottom-0">
                      <strong>Estimated time:</strong> {form.estimatedTime}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="display-flex flex-column tablet:flex-row margin-top-2">
                    <Link 
                      href={`/forms/${form.id}`}
                      className="usa-button margin-right-1 margin-bottom-1 flex-fill text-center"
                    >
                      Start Application
                    </Link>
                    <Link 
                      href={`/forms/${form.id}/preview`}
                      className="usa-button usa-button--outline margin-bottom-1 flex-fill text-center"
                    >
                      Preview Form
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Help Section */}
          <div className="grid-row margin-top-4">
            <div className="grid-col-12">
              <div className="usa-alert usa-alert--info">
                <div className="usa-alert__body">
                  <h4 className="usa-alert__heading">Need Help Choosing?</h4>
                  <p className="usa-alert__text">
                    Our forms are designed to guide you step-by-step through the immigration process. 
                    Each form includes:
                  </p>
                  <ul className="usa-list">
                    <li><strong>Smart validation:</strong> Real-time error checking</li>
                    <li><strong>Progress saving:</strong> Come back anytime to continue</li>
                    <li><strong>Multi-language support:</strong> Available in 4 languages</li>
                    <li><strong>Document upload:</strong> OCR-powered pre-filling</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="usa-section usa-section--light">
        <div className="grid-container">
          <div className="grid-row">
            <div className="tablet:grid-col-8 tablet:grid-offset-2 text-center">
              <h2 className="font-heading-xl">
                Don't See Your Form?
              </h2>
              <p className="font-body-lg text-base-dark margin-bottom-3">
                We're constantly adding new forms to our platform. Contact us to request 
                a specific form or get personalized assistance.
              </p>
              <Link 
                href="/contact" 
                className="usa-button usa-button--big usa-button--secondary"
              >
                Contact Support
              </Link>
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