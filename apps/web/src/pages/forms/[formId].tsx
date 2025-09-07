import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetStaticPaths, GetStaticPropsContext } from 'next';
import { useTranslations } from 'next-intl';
import FormRenderer from '../../components/FormRenderer';

interface FormPageProps {
  formSchema?: any;
  formId: string;
}

const formSchemas: { [key: string]: any } = {
  'i485': null, // Will be loaded dynamically
  'i130': null
};

export default function FormPage({ formId }: FormPageProps) {
  const router = useRouter();
  const t = useTranslations();
  const [formSchema, setFormSchema] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<any>(null);

  // Load form schema dynamically
  useEffect(() => {
    const loadFormSchema = async () => {
      try {
        setIsLoading(true);
        
        // Load the appropriate form schema
        const schemaModule = await import(`../../forms/${formId}-schema.json`);
        setFormSchema(schemaModule.default);

        // Load saved data from localStorage if available
        const savedFormData = localStorage.getItem(`immigration-form-${formId}`);
        if (savedFormData) {
          setSavedData(JSON.parse(savedFormData));
        }

      } catch (err: any) {
        console.error('Error loading form schema:', err);
        setError(`Form '${formId}' not found`);
      } finally {
        setIsLoading(false);
      }
    };

    if (formId && typeof formId === 'string') {
      loadFormSchema();
    }
  }, [formId]);

  const handleFormSubmit = (submission: any) => {
    console.log('Form submitted:', submission);
    
    // Save to localStorage for now (in production, this would go to a backend)
    localStorage.setItem(`immigration-form-${formId}-submission`, JSON.stringify(submission));
    
    // Clear the saved draft
    localStorage.removeItem(`immigration-form-${formId}`);
    
    // Show success message and redirect
    alert('Form submitted successfully! Your application has been saved.');
    router.push('/cases');
  };

  const handleFormSave = (submission: any) => {
    // Auto-save draft to localStorage
    localStorage.setItem(`immigration-form-${formId}`, JSON.stringify(submission.data));
  };

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Loading Form... - {t('home.title')}</title>
        </Head>
        
        <section className="usa-section">
          <div className="grid-container">
            <div className="usa-alert usa-alert--info">
              <div className="usa-alert__body">
                <p className="usa-alert__text">
                  Loading form...
                </p>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (error || !formSchema) {
    return (
      <>
        <Head>
          <title>Form Not Found - {t('home.title')}</title>
        </Head>
        
        <section className="usa-section">
          <div className="grid-container">
            <div className="usa-alert usa-alert--error">
              <div className="usa-alert__body">
                <h4 className="usa-alert__heading">Form Not Available</h4>
                <p className="usa-alert__text">
                  {error || 'The requested form could not be loaded.'}
                </p>
              </div>
            </div>
            
            <div className="margin-top-3">
              <button
                onClick={() => router.push('/forms')}
                className="usa-button"
              >
                Back to Forms
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  const formTitle = t(`forms.${formId}.title`) || formSchema.title;
  const formDescription = t(`forms.${formId}.description`) || formSchema.title;

  return (
    <>
      <Head>
        <title>{formTitle} - {t('home.title')}</title>
        <meta name="description" content={formDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Form Header */}
      <section className="usa-section usa-section--dark bg-primary-darker">
        <div className="grid-container">
          <div className="grid-row">
            <div className="grid-col-12">
              <div className="display-flex flex-align-center margin-bottom-2">
                <button
                  onClick={() => router.push('/forms')}
                  className="usa-button usa-button--unstyled text-white margin-right-2"
                  aria-label="Back to forms"
                >
                  ← Back
                </button>
                <div>
                  <h1 className="font-heading-xl margin-y-0 text-white">
                    {formTitle}
                  </h1>
                  <p className="font-body-lg text-primary-lighter margin-bottom-0 margin-top-05">
                    {formDescription}
                  </p>
                </div>
              </div>

              {/* Progress indicator */}
              {savedData && (
                <div className="usa-alert usa-alert--info usa-alert--slim">
                  <div className="usa-alert__body">
                    <p className="usa-alert__text">
                      📝 Draft saved - You can continue where you left off
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="usa-section">
        <div className="grid-container">
          <div className="grid-row">
            <div className="grid-col-12 tablet:grid-col-10 tablet:grid-offset-1 desktop:grid-col-8 desktop:grid-offset-2">
              
              {/* Instructions */}
              <div className="usa-alert usa-alert--info margin-bottom-4">
                <div className="usa-alert__body">
                  <h4 className="usa-alert__heading">Instructions</h4>
                  <ul className="usa-list">
                    <li>Fill out all required fields (marked with *)</li>
                    <li>Your progress is automatically saved</li>
                    <li>You can navigate between pages using the buttons below</li>
                    <li>Review all information before final submission</li>
                  </ul>
                </div>
              </div>

              {/* Form Renderer */}
              <div className="bg-white padding-4 border border-base-lighter">
                <FormRenderer
                  formSchema={formSchema}
                  onSubmit={handleFormSubmit}
                  onSave={handleFormSave}
                  initialData={savedData}
                />
              </div>

              {/* Help Section */}
              <div className="margin-top-4">
                <div className="usa-alert usa-alert--warning">
                  <div className="usa-alert__body">
                    <h4 className="usa-alert__heading">Need Help?</h4>
                    <p className="usa-alert__text">
                      If you're having trouble with any part of this form, our support team is here to help.
                    </p>
                    <div className="margin-top-2">
                      <button className="usa-button usa-button--outline">
                        Contact Support
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const formIds = ['i485', 'i130'];
  const paths: any[] = [];

  // Generate paths for all locales and form IDs
  formIds.forEach(formId => {
    locales?.forEach(locale => {
      paths.push({
        params: { formId },
        locale
      });
    });
  });

  return {
    paths,
    fallback: false
  };
};

export async function getStaticProps({ locale, params }: GetStaticPropsContext) {
  const formId = params?.formId as string;

  return {
    props: {
      messages: (await import(`../../messages/${locale || 'en'}.json`)).default,
      formId
    }
  };
}