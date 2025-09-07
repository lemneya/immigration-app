/**
 * Form.io Individual Form API Route
 * Handles CRUD operations for specific form templates
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Import form templates from the main forms API
const formTemplateIds = [
  'i485-template',
  'i130-template', 
  'i765-template',
  'n400-template',
  'g28-template'
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;
  const { id } = query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Form ID is required'
    });
  }

  switch (method) {
    case 'GET':
      try {
        // Check if form exists
        if (!formTemplateIds.includes(id)) {
          return res.status(404).json({
            success: false,
            error: 'Form template not found',
            message: `Form with ID "${id}" does not exist`
          });
        }

        // For now, return a simplified form structure
        // In a real implementation, you would fetch from database
        const formData = {
          id,
          name: id.replace('-template', '').toUpperCase(),
          title: getFormTitle(id),
          formType: id.replace('-template', ''),
          status: 'active',
          version: '1.0.0',
          fields: getFormFields(id),
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system'
          }
        };

        res.status(200).json({
          success: true,
          data: formData
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve form template',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;

    case 'PUT':
      try {
        const { name, title, schema, active } = req.body;
        
        if (!formTemplateIds.includes(id)) {
          return res.status(404).json({
            success: false,
            error: 'Form template not found'
          });
        }

        // In a real implementation, update the form in database
        const updatedForm = {
          id,
          name: name || id.replace('-template', '').toUpperCase(),
          title: title || getFormTitle(id),
          schema,
          active: active !== undefined ? active : true,
          updatedAt: new Date().toISOString()
        };

        res.status(200).json({
          success: true,
          data: updatedForm,
          message: 'Form template updated successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to update form template',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;

    case 'DELETE':
      try {
        if (!formTemplateIds.includes(id)) {
          return res.status(404).json({
            success: false,
            error: 'Form template not found'
          });
        }

        // In a real implementation, soft delete or remove from database
        res.status(200).json({
          success: true,
          message: `Form template ${id} deleted successfully`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to delete form template',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).json({
        success: false,
        error: `Method ${method} not allowed`
      });
      break;
  }
}

function getFormTitle(id: string): string {
  const titles: Record<string, string> = {
    'i485-template': 'Application to Register Permanent Residence or Adjust Status',
    'i130-template': 'Immigrant Petition for Alien Relative',
    'i765-template': 'Application for Employment Authorization',
    'n400-template': 'Application for Naturalization',
    'g28-template': 'Notice of Entry of Appearance as Attorney or Accredited Representative'
  };
  return titles[id] || 'Immigration Form';
}

function getFormFields(id: string): any[] {
  // Return basic field structure for each form type
  const fieldSets: Record<string, any[]> = {
    'i485-template': [
      {
        section: 'Personal Information',
        fields: [
          { name: 'familyName', type: 'text', required: true, label: 'Family Name (Last Name)' },
          { name: 'givenName', type: 'text', required: true, label: 'Given Name (First Name)' },
          { name: 'middleName', type: 'text', required: false, label: 'Middle Name' },
          { name: 'dateOfBirth', type: 'date', required: true, label: 'Date of Birth' },
          { name: 'countryOfBirth', type: 'select', required: true, label: 'Country of Birth' },
          { name: 'countryOfCitizenship', type: 'select', required: true, label: 'Country of Citizenship' }
        ]
      },
      {
        section: 'Contact Information',
        fields: [
          { name: 'streetAddress', type: 'text', required: true, label: 'Street Number and Name' },
          { name: 'city', type: 'text', required: true, label: 'City or Town' },
          { name: 'state', type: 'select', required: true, label: 'State' },
          { name: 'zipCode', type: 'text', required: true, label: 'ZIP Code' }
        ]
      }
    ],
    'i130-template': [
      {
        section: 'Petitioner Information',
        fields: [
          { name: 'petitionerName', type: 'text', required: true, label: 'Petitioner Full Name' },
          { name: 'alienNumber', type: 'text', required: false, label: 'A-Number' },
          { name: 'uscisNumber', type: 'text', required: false, label: 'USCIS Online Account Number' }
        ]
      },
      {
        section: 'Beneficiary Information', 
        fields: [
          { name: 'beneficiaryName', type: 'text', required: true, label: 'Beneficiary Full Name' },
          { name: 'relationship', type: 'select', required: true, label: 'Relationship to Petitioner' },
          { name: 'dateOfBirth', type: 'date', required: true, label: 'Date of Birth' }
        ]
      }
    ],
    'i765-template': [
      {
        section: 'Application Information',
        fields: [
          { name: 'applicationReason', type: 'radio', required: true, label: 'I am applying for' },
          { name: 'eligibilityCategory', type: 'text', required: true, label: 'Eligibility Category' },
          { name: 'familyName', type: 'text', required: true, label: 'Family Name (Last Name)' },
          { name: 'givenName', type: 'text', required: true, label: 'Given Name (First Name)' }
        ]
      }
    ],
    'n400-template': [
      {
        section: 'Eligibility Information',
        fields: [
          { name: 'eligibilityBasis', type: 'radio', required: true, label: 'Basis for Eligibility' },
          { name: 'currentName', type: 'text', required: true, label: 'Current Legal Name' },
          { name: 'nameChange', type: 'checkbox', required: false, label: 'Do you want to legally change your name?' }
        ]
      }
    ],
    'g28-template': [
      {
        section: 'Attorney Information',
        fields: [
          { name: 'attorneyName', type: 'text', required: true, label: 'Attorney/Representative Name' },
          { name: 'barNumber', type: 'text', required: true, label: 'Bar Number' },
          { name: 'lawFirm', type: 'text', required: false, label: 'Law Firm Name' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone Number' },
          { name: 'email', type: 'email', required: true, label: 'Email Address' }
        ]
      },
      {
        section: 'Client Information',
        fields: [
          { name: 'clientName', type: 'text', required: true, label: 'Client Name' },
          { name: 'alienNumber', type: 'text', required: false, label: 'A-Number' }
        ]
      }
    ]
  };

  return fieldSets[id] || [];
}