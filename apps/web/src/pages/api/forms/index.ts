/**
 * Form.io Integration API Routes
 * Provides form templates and management for immigration forms
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface FormTemplate {
  id: string;
  name: string;
  title: string;
  formType: 'i485' | 'i130' | 'i765' | 'n400' | 'g28';
  version: string;
  schema: any;
  uiSchema?: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mock form templates for immigration forms
const formTemplates: FormTemplate[] = [
  {
    id: 'i485-template',
    name: 'I-485 Application',
    title: 'Application to Register Permanent Residence or Adjust Status',
    formType: 'i485',
    version: '1.0.0',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      type: 'object',
      properties: {
        personalInfo: {
          type: 'object',
          title: 'Personal Information',
          properties: {
            familyName: {
              type: 'string',
              title: 'Family Name (Last Name)',
              required: true
            },
            givenName: {
              type: 'string',
              title: 'Given Name (First Name)',
              required: true
            },
            middleName: {
              type: 'string',
              title: 'Middle Name'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              title: 'Date of Birth',
              required: true
            },
            countryOfBirth: {
              type: 'string',
              title: 'Country of Birth',
              required: true
            },
            countryOfCitizenship: {
              type: 'string',
              title: 'Country of Citizenship',
              required: true
            }
          }
        },
        contactInfo: {
          type: 'object',
          title: 'Contact Information',
          properties: {
            physicalAddress: {
              type: 'object',
              title: 'Physical Address',
              properties: {
                streetNumber: { type: 'string', title: 'Street Number and Name' },
                unit: { type: 'string', title: 'Apt/Ste/Flr Number' },
                city: { type: 'string', title: 'City or Town' },
                state: { type: 'string', title: 'State' },
                zipCode: { type: 'string', title: 'ZIP Code' },
                province: { type: 'string', title: 'Province' },
                postalCode: { type: 'string', title: 'Postal Code' },
                country: { type: 'string', title: 'Country' }
              }
            },
            mailingAddress: {
              type: 'object',
              title: 'Mailing Address (if different)',
              properties: {
                inCareOf: { type: 'string', title: 'In Care Of Name' },
                streetNumber: { type: 'string', title: 'Street Number and Name' },
                unit: { type: 'string', title: 'Apt/Ste/Flr Number' },
                city: { type: 'string', title: 'City or Town' },
                state: { type: 'string', title: 'State' },
                zipCode: { type: 'string', title: 'ZIP Code' },
                province: { type: 'string', title: 'Province' },
                postalCode: { type: 'string', title: 'Postal Code' },
                country: { type: 'string', title: 'Country' }
              }
            }
          }
        },
        applicationCategory: {
          type: 'string',
          title: 'Application Category',
          enum: [
            'immediate_relative_us_citizen',
            'child_us_citizen',
            'spouse_lawful_permanent_resident',
            'unmarried_child_lawful_permanent_resident',
            'refugee',
            'asylee',
            'other'
          ],
          enumNames: [
            'Immediate relative of a U.S. citizen',
            'Child of a U.S. citizen',
            'Spouse of a lawful permanent resident',
            'Unmarried child of a lawful permanent resident',
            'Refugee',
            'Asylee',
            'Other'
          ]
        }
      }
    }
  },
  {
    id: 'i130-template',
    name: 'I-130 Petition',
    title: 'Immigrant Petition for Alien Relative',
    formType: 'i130',
    version: '1.0.0',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      type: 'object',
      properties: {
        petitionerInfo: {
          type: 'object',
          title: 'Petitioner Information',
          properties: {
            familyName: {
              type: 'string',
              title: 'Family Name (Last Name)',
              required: true
            },
            givenName: {
              type: 'string',
              title: 'Given Name (First Name)',
              required: true
            },
            middleName: {
              type: 'string',
              title: 'Middle Name'
            },
            alienNumber: {
              type: 'string',
              title: 'A-Number (if any)',
              pattern: '^A[0-9]{8,9}$'
            },
            uscisOnlineAccountNumber: {
              type: 'string',
              title: 'USCIS Online Account Number (if any)'
            }
          }
        },
        beneficiaryInfo: {
          type: 'object',
          title: 'Beneficiary Information',
          properties: {
            familyName: {
              type: 'string',
              title: 'Family Name (Last Name)',
              required: true
            },
            givenName: {
              type: 'string',
              title: 'Given Name (First Name)',
              required: true
            },
            middleName: {
              type: 'string',
              title: 'Middle Name'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              title: 'Date of Birth',
              required: true
            },
            countryOfBirth: {
              type: 'string',
              title: 'Country of Birth',
              required: true
            }
          }
        },
        relationship: {
          type: 'string',
          title: 'Relationship to Petitioner',
          enum: [
            'spouse',
            'unmarried_child_under_21',
            'unmarried_child_21_or_over',
            'married_child',
            'parent',
            'sibling'
          ],
          enumNames: [
            'Spouse',
            'Unmarried child under 21 years old',
            'Unmarried child 21 years old or over',
            'Married child',
            'Parent',
            'Brother or sister'
          ]
        }
      }
    }
  },
  {
    id: 'i765-template',
    name: 'I-765 Application',
    title: 'Application for Employment Authorization',
    formType: 'i765',
    version: '1.0.0',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      type: 'object',
      properties: {
        applicationReason: {
          type: 'string',
          title: 'I am applying for',
          enum: [
            'initial_permission',
            'replacement_lost',
            'replacement_stolen',
            'replacement_damaged',
            'renewal'
          ],
          enumNames: [
            'Initial permission to accept employment',
            'Replacement (card was lost)',
            'Replacement (card was stolen)', 
            'Replacement (card was damaged)',
            'Renewal of permission to accept employment'
          ]
        },
        eligibilityCategory: {
          type: 'string',
          title: 'Eligibility Category',
          description: 'Select the category that applies to your situation'
        },
        personalInfo: {
          type: 'object',
          title: 'Personal Information',
          properties: {
            familyName: {
              type: 'string',
              title: 'Family Name (Last Name)',
              required: true
            },
            givenName: {
              type: 'string',
              title: 'Given Name (First Name)',
              required: true
            },
            middleName: {
              type: 'string',
              title: 'Middle Name'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              title: 'Date of Birth',
              required: true
            },
            countryOfBirth: {
              type: 'string',
              title: 'Country of Birth',
              required: true
            },
            countryOfCitizenship: {
              type: 'string',
              title: 'Country of Citizenship',
              required: true
            },
            alienNumber: {
              type: 'string',
              title: 'A-Number (if any)',
              pattern: '^A[0-9]{8,9}$'
            }
          }
        }
      }
    }
  },
  {
    id: 'n400-template',
    name: 'N-400 Application',
    title: 'Application for Naturalization',
    formType: 'n400',
    version: '1.0.0',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      type: 'object',
      properties: {
        eligibilityBasis: {
          type: 'string',
          title: 'Basis for Eligibility',
          enum: [
            'five_year_resident',
            'three_year_spouse_citizen',
            'qualifying_military_service',
            'other'
          ],
          enumNames: [
            '5 years as a Lawful Permanent Resident',
            '3 years as a Lawful Permanent Resident married to U.S. citizen',
            'Qualifying military service',
            'Other'
          ]
        },
        personalInfo: {
          type: 'object',
          title: 'Personal Information',
          properties: {
            currentLegalName: {
              type: 'object',
              title: 'Your Current Legal Name',
              properties: {
                familyName: { type: 'string', title: 'Family Name (Last Name)' },
                givenName: { type: 'string', title: 'Given Name (First Name)' },
                middleName: { type: 'string', title: 'Middle Name' }
              }
            },
            nameChange: {
              type: 'boolean',
              title: 'Do you want to legally change your name?'
            },
            newName: {
              type: 'object',
              title: 'New Name (if changing)',
              properties: {
                familyName: { type: 'string', title: 'New Family Name' },
                givenName: { type: 'string', title: 'New Given Name' },
                middleName: { type: 'string', title: 'New Middle Name' }
              }
            }
          }
        }
      }
    }
  },
  {
    id: 'g28-template',
    name: 'G-28 Form',
    title: 'Notice of Entry of Appearance as Attorney or Accredited Representative',
    formType: 'g28',
    version: '1.0.0',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      type: 'object',
      properties: {
        attorneyInfo: {
          type: 'object',
          title: 'Attorney/Representative Information',
          properties: {
            barNumber: {
              type: 'string',
              title: 'Bar Number',
              required: true
            },
            name: {
              type: 'string',
              title: 'Attorney/Representative Name',
              required: true
            },
            lawFirmName: {
              type: 'string',
              title: 'Law Firm or Organization Name'
            },
            address: {
              type: 'object',
              title: 'Business Address',
              properties: {
                street: { type: 'string', title: 'Street Address' },
                city: { type: 'string', title: 'City' },
                state: { type: 'string', title: 'State' },
                zipCode: { type: 'string', title: 'ZIP Code' }
              }
            },
            phone: {
              type: 'string',
              title: 'Phone Number',
              pattern: '^[0-9]{3}-[0-9]{3}-[0-9]{4}$'
            },
            email: {
              type: 'string',
              format: 'email',
              title: 'Email Address'
            }
          }
        },
        clientInfo: {
          type: 'object',
          title: 'Client Information',
          properties: {
            name: {
              type: 'string',
              title: 'Client Name',
              required: true
            },
            alienNumber: {
              type: 'string',
              title: 'A-Number',
              pattern: '^A[0-9]{8,9}$'
            },
            caseNumbers: {
              type: 'array',
              title: 'Case Numbers',
              items: {
                type: 'string',
                title: 'Case Number'
              }
            }
          }
        }
      }
    }
  }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        const { formType, active } = req.query;
        
        let filteredTemplates = formTemplates;
        
        // Filter by form type if specified
        if (formType && typeof formType === 'string') {
          filteredTemplates = filteredTemplates.filter(template => 
            template.formType === formType
          );
        }
        
        // Filter by active status if specified
        if (active !== undefined) {
          const isActive = active === 'true';
          filteredTemplates = filteredTemplates.filter(template => 
            template.active === isActive
          );
        }
        
        res.status(200).json({
          success: true,
          data: filteredTemplates,
          total: filteredTemplates.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve form templates',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;
      
    case 'POST':
      try {
        const { name, title, formType, schema, uiSchema } = req.body;
        
        if (!name || !title || !formType || !schema) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, title, formType, schema'
          });
        }
        
        const newTemplate: FormTemplate = {
          id: `${formType}-${Date.now()}`,
          name,
          title,
          formType,
          version: '1.0.0',
          schema,
          uiSchema,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        formTemplates.push(newTemplate);
        
        res.status(201).json({
          success: true,
          data: newTemplate,
          message: 'Form template created successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create form template',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        error: `Method ${method} not allowed`
      });
      break;
  }
}