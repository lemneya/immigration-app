import { useLocale, useTranslations } from 'next-intl';
import { ReactNode } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { rtlLocales } from '../i18n';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const locale = useLocale();
  const t = useTranslations();
  const isRTL = rtlLocales.includes(locale as any);

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'font-arabic' : 'font-latin'}`} dir={isRTL ? 'rtl' : 'ltr'} lang={locale}>
      {/* USWDS Header */}
      <header className="usa-header usa-header--basic" role="banner">
        <div className="usa-nav-container">
          <div className="usa-navbar">
            {/* Logo */}
            <div className="usa-logo" id="logo">
              <em className="usa-logo__text">
                <a href="/" className="text-2xl font-bold text-uswds-blue-700">
                  🌍 {t('home.title')}
                </a>
              </em>
            </div>

            {/* Mobile menu button */}
            <button className="usa-menu-btn">Menu</button>
          </div>

          {/* Navigation */}
          <nav className="usa-nav" role="navigation">
            <div className="usa-nav__inner">
              <button className="usa-nav__close">
                <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
                  <use xlinkHref="#close"></use>
                </svg>
              </button>

              {/* Primary Navigation */}
              <ul className="usa-nav__primary usa-accordion">
                <li className="usa-nav__primary-item">
                  <a href="/" className="usa-nav__link">
                    {t('navigation.home')}
                  </a>
                </li>
                <li className="usa-nav__primary-item">
                  <a href="/forms" className="usa-nav__link">
                    {t('navigation.forms')}
                  </a>
                </li>
                <li className="usa-nav__primary-item">
                  <a href="/cases" className="usa-nav__link">
                    {t('navigation.cases')}
                  </a>
                </li>
                <li className="usa-nav__primary-item">
                  <a href="/documents" className="usa-nav__link">
                    {t('navigation.documents')}
                  </a>
                </li>
                <li className="usa-nav__primary-item">
                  <a href="/help" className="usa-nav__link">
                    {t('navigation.help')}
                  </a>
                </li>
              </ul>

              {/* Secondary Navigation */}
              <div className="usa-nav__secondary">
                <ul className="usa-nav__secondary-links">
                  <li className="usa-nav__secondary-item">
                    <LanguageSwitcher />
                  </li>
                  <li className="usa-nav__secondary-item">
                    <a href="/account" className="usa-nav__link">
                      {t('navigation.account')}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="usa-section" id="main-content">
        <div className="grid-container">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="usa-footer usa-footer--slim" role="contentinfo">
        <div className="grid-container">
          <div className="usa-footer__return-to-top">
            <a href="#" className="usa-footer__return-to-top-link">
              {t('common.home')}
            </a>
          </div>
          <div className="usa-footer__primary-section">
            <div className="grid-row">
              <div className="grid-col-12">
                <nav className="usa-footer__nav">
                  <ul className="add-list-reset grid-row grid-gap">
                    <li className="mobile-lg:grid-col-4 desktop:grid-col-auto">
                      <a className="usa-footer__primary-link" href="/privacy">
                        {t('footer.privacy')}
                      </a>
                    </li>
                    <li className="mobile-lg:grid-col-4 desktop:grid-col-auto">
                      <a className="usa-footer__primary-link" href="/terms">
                        {t('footer.terms')}
                      </a>
                    </li>
                    <li className="mobile-lg:grid-col-4 desktop:grid-col-auto">
                      <a className="usa-footer__primary-link" href="/contact">
                        {t('footer.contact')}
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
          <div className="usa-footer__secondary-section">
            <div className="grid-row">
              <div className="grid-col-12">
                <p className="usa-footer__logo-heading">
                  {t('home.title')}
                </p>
                <p className="usa-footer__contact-info">
                  {t('footer.copyright')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}