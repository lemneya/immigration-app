import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface FormRendererProps {
  formSchema: any;
  onSubmit?: (submission: any) => void;
  onSave?: (submission: any) => void;
  initialData?: any;
  readOnly?: boolean;
}

interface FormData {
  [key: string]: any;
}

export default function FormRenderer({ 
  formSchema, 
  onSubmit, 
  onSave, 
  initialData,
  readOnly = false 
}: FormRendererProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialData || {});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const pages = formSchema?.components || [];
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  // Auto-save when form data changes
  useEffect(() => {
    if (onSave && Object.keys(formData).length > 0) {
      onSave({ data: formData });
    }
  }, [formData, onSave]);

  const validateField = (component: any, value: any): string | null => {
    if (component.validate?.required && (!value || value.toString().trim() === '')) {
      return `${component.label} is required`;
    }
    
    if (component.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    if (component.validate?.pattern && value) {
      const regex = new RegExp(component.validate.pattern);
      if (!regex.test(value)) {
        return 'Please enter a valid format';
      }
    }

    if (component.validate?.minLength && value && value.length < component.validate.minLength) {
      return `Must be at least ${component.validate.minLength} characters`;
    }

    return null;
  };

  const validateCurrentPage = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    let isValid = true;

    currentPage.components?.forEach((component: any) => {
      const value = formData[component.key];
      const error = validateField(component, value);
      
      if (error) {
        newErrors[component.key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));

    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({
        ...prev,
        [key]: ''
      }));
    }
  };

  const handleNext = () => {
    if (validateCurrentPage()) {
      setCurrentPageIndex(prev => Math.min(prev + 1, pages.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentPageIndex(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateCurrentPage()) {
      if (onSubmit) {
        onSubmit({
          data: formData,
          metadata: {
            formId: formSchema.name,
            submittedAt: new Date().toISOString(),
            locale
          }
        });
      }
    }
  };

  const renderField = (component: any) => {
    const value = formData[component.key] || '';
    const error = errors[component.key];
    const hasError = !!error;

    const commonProps = {
      id: component.key,
      name: component.key,
      disabled: readOnly || component.disabled,
      required: component.validate?.required,
      className: `usa-input ${component.customClass || ''} ${hasError ? 'usa-input--error' : ''}`.trim()
    };

    const handleChange = (e: React.ChangeEvent<any>) => {
      handleFieldChange(component.key, e.target.value);
    };

    const renderLabel = () => (
      <label htmlFor={component.key} className={`usa-label ${component.validate?.required ? 'usa-label--required' : ''}`}>
        {component.label}
        {component.validate?.required && <span className="text-secondary-dark"> *</span>}
      </label>
    );

    const renderError = () => error && (
      <div className="usa-error-message" role="alert">
        {error}
      </div>
    );

    const renderDescription = () => component.description && (
      <div className="usa-hint">{component.description}</div>
    );

    switch (component.type) {
      case 'textfield':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            {renderLabel()}
            {renderDescription()}
            {renderError()}
            <input
              type="text"
              {...commonProps}
              value={value}
              onChange={handleChange}
              placeholder={component.placeholder}
            />
          </div>
        );

      case 'email':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            {renderLabel()}
            {renderDescription()}
            {renderError()}
            <input
              type="email"
              {...commonProps}
              value={value}
              onChange={handleChange}
              placeholder={component.placeholder}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            {renderLabel()}
            {renderDescription()}
            {renderError()}
            <textarea
              {...commonProps}
              className={`usa-textarea ${component.customClass || ''} ${hasError ? 'usa-textarea--error' : ''}`.trim()}
              value={value}
              onChange={handleChange}
              placeholder={component.placeholder}
              rows={component.rows || 4}
            />
          </div>
        );

      case 'select':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            {renderLabel()}
            {renderDescription()}
            {renderError()}
            <select
              {...commonProps}
              className={`usa-select ${component.customClass || ''} ${hasError ? 'usa-select--error' : ''}`.trim()}
              value={value}
              onChange={handleChange}
            >
              <option value="">- Select -</option>
              {component.data?.values?.map((option: any) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'datetime':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            {renderLabel()}
            {renderDescription()}
            {renderError()}
            <input
              type="date"
              {...commonProps}
              value={value}
              onChange={handleChange}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={component.key} className={`usa-form-group ${hasError ? 'usa-form-group--error' : ''}`}>
            <fieldset className="usa-fieldset">
              <legend className="usa-legend">{component.label}</legend>
              {renderDescription()}
              {renderError()}
              {component.values?.map((option: any) => (
                <div key={option.value} className="usa-radio">
                  <input
                    type="radio"
                    id={`${component.key}-${option.value}`}
                    name={component.key}
                    value={option.value}
                    checked={value === option.value}
                    onChange={handleChange}
                    disabled={readOnly || component.disabled}
                    className="usa-radio__input"
                  />
                  <label htmlFor={`${component.key}-${option.value}`} className="usa-radio__label">
                    {option.label}
                  </label>
                </div>
              ))}
            </fieldset>
          </div>
        );

      default:
        return (
          <div key={component.key} className="usa-form-group">
            <div className="usa-alert usa-alert--warning">
              <div className="usa-alert__body">
                <p className="usa-alert__text">
                  Field type '{component.type}' not supported yet.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  if (!formSchema || !currentPage) {
    return (
      <div className="usa-alert usa-alert--error">
        <div className="usa-alert__body">
          <p className="usa-alert__text">
            Form configuration error
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="immigration-form-renderer">
      {/* Progress Bar */}
      <div className="usa-step-indicator usa-step-indicator--no-labels margin-bottom-4">
        <ol className="usa-step-indicator__segments">
          {pages.map((_: any, index: number) => (
            <li
              key={index}
              className={`usa-step-indicator__segment ${
                index === currentPageIndex
                  ? 'usa-step-indicator__segment--current'
                  : index < currentPageIndex
                  ? 'usa-step-indicator__segment--complete'
                  : ''
              }`}
            >
              <span className="usa-step-indicator__segment-label">
                Step {index + 1} of {pages.length}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Current Page */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="usa-form">
          <h2 className="font-heading-xl margin-bottom-3">
            {currentPage.title}
          </h2>

          <div className="margin-bottom-4">
            {currentPage.components?.map((component: any) => renderField(component))}
          </div>

          {/* Navigation */}
          <div className="usa-button-group margin-top-4">
            {!isFirstPage && (
              <button
                type="button"
                className="usa-button usa-button--outline"
                onClick={handlePrevious}
              >
                ← {t('common.previous')}
              </button>
            )}

            {!isLastPage ? (
              <button
                type="button"
                className="usa-button"
                onClick={handleNext}
              >
                {t('common.next')} →
              </button>
            ) : (
              <button
                type="submit"
                className="usa-button"
                disabled={readOnly}
              >
                {t('common.submit')}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}