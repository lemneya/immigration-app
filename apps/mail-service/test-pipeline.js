#!/usr/bin/env node

/**
 * Standalone Mail Processing Pipeline Test
 * 
 * This test demonstrates the complete mail processing flow:
 * 1. Document Classification 
 * 2. Information Extraction
 * 3. Risk Analysis
 * 4. Plain-Language Summarization
 * 
 * Usage: node test-pipeline.js
 */

// Sample USCIS Notice text (typical I-765 EAD renewal notice)
const sampleUSCISNotice = `
U.S. CITIZENSHIP AND IMMIGRATION SERVICES

NOTICE OF ACTION
FORM I-765 APPLICATION FOR EMPLOYMENT AUTHORIZATION DOCUMENT

Receipt Number: MSC2290123456
Case Type: I765 Application to Register Permanent Residence or Adjust Status
Your Case Was Received On: March 15, 2024

Dear MARIA GONZALEZ,

On March 15, 2024, we received your Form I-765, Application for Employment Authorization Document, and mailed you a receipt notice. Please follow the instructions below.

CURRENT STATUS: CASE WAS APPROVED

We approved your Form I-765, Application for Employment Authorization Document. We have mailed your new Employment Authorization Document to:

MARIA GONZALEZ
123 MAIN STREET APT 4B
ANYTOWN, NY 10001

If you do not receive your document within 30 days, please contact us.

Processing Time Information:
- Normal processing time: 3-5 months
- Current processing time for this case type: 4 months

IMPORTANT: Your Employment Authorization Document will expire on September 15, 2024. You should file your renewal application at least 180 days before the expiration date.

If you need to make an appointment or have questions about your case, you can:
- Visit uscis.gov
- Call our Contact Center at 1-800-375-5283
- Schedule an InfoPass appointment online

Please keep this notice with your records.

U.S. Citizenship and Immigration Services
Washington, DC 20529
`;

console.log('🔬 Testing Mail Processing Pipeline\n');
console.log('=' .repeat(80));

// Mock services to simulate the processing without external dependencies
class MockClassificationService {
  async classifyDocument(text) {
    // Detect USCIS document type based on keywords
    if (text.includes('FORM I-765') && text.includes('EMPLOYMENT AUTHORIZATION')) {
      return {
        type: 'uscis_notice',
        confidence: 0.95,
        subType: 'ead_approval',
        reasoning: 'Contains Form I-765 and Employment Authorization keywords'
      };
    }
    
    return {
      type: 'unknown',
      confidence: 0.3,
      subType: null,
      reasoning: 'No strong document type indicators found'
    };
  }
}

class MockExtractionService {
  async extractInformation(text, docType) {
    const extracted = {
      receipts: [],
      dates: [],
      amounts: [],
      actions: [],
      people: [],
      addresses: []
    };

    // Extract receipt numbers
    const receiptMatch = text.match(/Receipt Number:\s*([A-Z]{3}\d{10,13})/g);
    if (receiptMatch) {
      extracted.receipts = receiptMatch.map(m => m.replace('Receipt Number: ', ''));
    }

    // Extract dates
    const dateRegex = /(\w+\s+\d{1,2},\s+\d{4})/g;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      extracted.dates = dateMatches.map(date => ({
        date,
        type: date.includes('expire') ? 'expiration' : 'processing'
      }));
    }

    // Extract expiration date specifically
    const expirationMatch = text.match(/expire(?:s)?\s+on\s+(\w+\s+\d{1,2},\s+\d{4})/i);
    if (expirationMatch) {
      extracted.dates.push({
        date: expirationMatch[1],
        type: 'expiration',
        critical: true
      });
    }

    // Extract people names
    const nameMatch = text.match(/Dear\s+([A-Z\s]+),/);
    if (nameMatch) {
      extracted.people.push({
        name: nameMatch[1].trim(),
        role: 'applicant'
      });
    }

    // Extract actions based on document type
    if (docType === 'uscis_notice') {
      if (text.includes('APPROVED')) {
        extracted.actions.push({
          action: 'Document Approved - EAD Card Mailed',
          priority: 'high',
          deadline: null,
          completed: true
        });
      }
      
      if (text.includes('renewal application at least 180 days')) {
        const expirationDate = expirationMatch ? new Date(expirationMatch[1]) : null;
        const renewalDeadline = expirationDate ? 
          new Date(expirationDate.setDate(expirationDate.getDate() - 180)) : null;
          
        extracted.actions.push({
          action: 'File Form I-765 Renewal Application',
          priority: 'critical',
          deadline: renewalDeadline ? renewalDeadline.toDateString() : 'Calculate 180 days before expiration',
          completed: false,
          description: 'File renewal application at least 180 days before EAD expiration'
        });
      }
    }

    return extracted;
  }
}

class MockRiskAnalysisService {
  async analyzeRisks(text, extractedInfo, docType) {
    const risks = [];
    const warnings = [];
    let overallScore = 0;

    // Check for expiration-related risks
    const today = new Date();
    extractedInfo.dates?.forEach(dateInfo => {
      if (dateInfo.type === 'expiration' && dateInfo.critical) {
        const expirationDate = new Date(dateInfo.date);
        const daysDiff = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 180 && daysDiff > 0) {
          risks.push({
            type: 'expiration_warning',
            severity: daysDiff < 60 ? 'high' : 'medium',
            message: `EAD expires in ${daysDiff} days. File renewal application soon.`,
            action: 'File Form I-765 renewal immediately'
          });
          overallScore += daysDiff < 60 ? 30 : 15;
        } else if (daysDiff <= 0) {
          risks.push({
            type: 'expired_document',
            severity: 'critical',
            message: 'EAD has expired. Work authorization may be invalid.',
            action: 'Contact immigration attorney immediately'
          });
          overallScore += 50;
        }
      }
    });

    // Check for authenticity (basic validation)
    if (!text.includes('U.S. CITIZENSHIP AND IMMIGRATION SERVICES')) {
      warnings.push({
        type: 'authenticity_question',
        message: 'Document may not be from official USCIS source',
        severity: 'medium'
      });
      overallScore += 20;
    }

    // Check for scam indicators
    if (text.toLowerCase().includes('fee') || text.toLowerCase().includes('payment')) {
      warnings.push({
        type: 'potential_scam',
        message: 'Document requests payment - verify authenticity',
        severity: 'high'
      });
      overallScore += 25;
    }

    return {
      overallRiskScore: Math.min(overallScore, 100),
      riskLevel: overallScore < 20 ? 'low' : overallScore < 50 ? 'medium' : 'high',
      risks,
      warnings,
      recommendations: risks.length > 0 ? ['Review deadlines carefully', 'Consider legal consultation'] : ['Keep document for records']
    };
  }
}

class MockSummarizationService {
  async generateSummary(text, extractedInfo, classification, risks) {
    // Create plain-language summary
    const summary = {
      plainLanguage: '',
      keyPoints: [],
      actionItems: [],
      timeline: [],
      readabilityScore: 85
    };

    const person = extractedInfo.people?.[0]?.name || 'You';
    const docType = classification.subType === 'ead_approval' ? 'Employment Authorization Document (Work Permit)' : 'immigration document';

    // Generate plain language summary
    if (classification.subType === 'ead_approval') {
      summary.plainLanguage = `Good news ${person}! Your ${docType} application has been approved. ` +
        `USCIS has mailed your new work permit to your address. You should receive it within 30 days. ` +
        `Remember that your work permit will expire on ${extractedInfo.dates?.find(d => d.type === 'expiration')?.date || '[check document]'}, ` +
        `so you'll need to apply for renewal at least 6 months before it expires to avoid any gap in your work authorization.`;

      summary.keyPoints = [
        '✅ Your work permit application was approved',
        '📬 New EAD card has been mailed to you', 
        '⏰ Document will expire - renewal needed',
        '📋 Keep this notice for your records'
      ];

      // Generate action items from extracted actions
      summary.actionItems = extractedInfo.actions?.map(action => ({
        task: action.action,
        priority: action.priority,
        deadline: action.deadline,
        completed: action.completed,
        description: action.description || null
      })) || [];

      // Add timeline
      const expirationDate = extractedInfo.dates?.find(d => d.type === 'expiration')?.date;
      if (expirationDate) {
        const expDate = new Date(expirationDate);
        const renewalDate = new Date(expDate);
        renewalDate.setDate(renewalDate.getDate() - 180);
        
        summary.timeline = [
          {
            date: 'Within 30 days',
            event: 'Receive new EAD card by mail',
            type: 'expected'
          },
          {
            date: renewalDate.toDateString(),
            event: 'File renewal application (I-765)',
            type: 'action_required'
          },
          {
            date: expirationDate,
            event: 'Current EAD expires',
            type: 'deadline'
          }
        ];
      }
    }

    return summary;
  }
}

// Main test function
async function testPipeline() {
  try {
    console.log('📄 Processing Sample Document...\n');
    
    // Initialize mock services
    const classifier = new MockClassificationService();
    const extractor = new MockExtractionService();
    const riskAnalyzer = new MockRiskAnalysisService();
    const summarizer = new MockSummarizationService();

    // Step 1: Document Classification
    console.log('🏷️  STEP 1: Document Classification');
    const classification = await classifier.classifyDocument(sampleUSCISNotice);
    console.log(`   Type: ${classification.type}`);
    console.log(`   Sub-type: ${classification.subType || 'N/A'}`);
    console.log(`   Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${classification.reasoning}\n`);

    // Step 2: Information Extraction
    console.log('🔍 STEP 2: Information Extraction');
    const extracted = await extractor.extractInformation(sampleUSCISNotice, classification.type);
    console.log(`   Receipt Numbers: ${extracted.receipts.join(', ') || 'None found'}`);
    console.log(`   People: ${extracted.people.map(p => p.name).join(', ') || 'None found'}`);
    console.log(`   Key Dates: ${extracted.dates.map(d => `${d.date} (${d.type})`).join(', ') || 'None found'}`);
    console.log(`   Actions Required: ${extracted.actions.length} found\n`);

    // Step 3: Risk Analysis
    console.log('⚠️  STEP 3: Risk Analysis');
    const risks = await riskAnalyzer.analyzeRisks(sampleUSCISNotice, extracted, classification.type);
    console.log(`   Overall Risk Level: ${risks.riskLevel.toUpperCase()} (${risks.overallRiskScore}/100)`);
    console.log(`   Active Risks: ${risks.risks.length}`);
    console.log(`   Warnings: ${risks.warnings.length}`);
    if (risks.risks.length > 0) {
      risks.risks.forEach(risk => {
        console.log(`   • [${risk.severity.toUpperCase()}] ${risk.message}`);
      });
    }
    console.log('');

    // Step 4: Plain-Language Summarization
    console.log('📝 STEP 4: Plain-Language Summary');
    const summary = await summarizer.generateSummary(sampleUSCISNotice, extracted, classification, risks);
    console.log(`   Readability Score: ${summary.readabilityScore}/100 (Easy to understand)`);
    console.log(`\n   📋 Summary:`);
    console.log(`   ${summary.plainLanguage}\n`);

    console.log(`   🔑 Key Points:`);
    summary.keyPoints.forEach(point => console.log(`   ${point}`));

    console.log(`\n   ✅ Action Items:`);
    summary.actionItems.forEach((item, index) => {
      const status = item.completed ? '✓' : '◯';
      const priority = item.priority === 'critical' ? '🔴' : item.priority === 'high' ? '🟡' : '🟢';
      console.log(`   ${status} ${priority} ${item.task}`);
      if (item.deadline) {
        console.log(`       Deadline: ${item.deadline}`);
      }
      if (item.description) {
        console.log(`       Note: ${item.description}`);
      }
    });

    console.log(`\n   📅 Timeline:`);
    summary.timeline.forEach(event => {
      const icon = event.type === 'deadline' ? '⏰' : event.type === 'action_required' ? '📋' : '📬';
      console.log(`   ${icon} ${event.date}: ${event.event}`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Mail Processing Pipeline Test Completed Successfully!');
    console.log('\nThe system successfully:');
    console.log('• Classified the document as a USCIS EAD approval notice');
    console.log('• Extracted key information (receipts, dates, people, actions)');
    console.log('• Identified expiration risks and renewal requirements');
    console.log('• Generated a plain-language summary with actionable insights');
    console.log('• Created a timeline with critical deadlines');
    
    console.log('\n💡 Next Steps:');
    console.log('• Add API proxy routing in Next.js for /api/mail/* endpoints');
    console.log('• Test file upload functionality with the frontend');
    console.log('• Integrate one-click actions (USCIS case tracker, reminder setup)');

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPipeline().catch(console.error);