-- PostgreSQL initialization script for Bmore vector database
-- This script sets up the vector database for embeddings

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    embedding VECTOR(384), -- Default dimension for all-MiniLM-L6-v2, can be adjusted
    metadata JSONB DEFAULT '{}',
    language VARCHAR(2) DEFAULT 'en',
    collection VARCHAR(100) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_embeddings_collection ON embeddings (collection);
CREATE INDEX IF NOT EXISTS idx_embeddings_language ON embeddings (language);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings (created_at DESC);

-- Create vector similarity index (HNSW for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_embeddings_embedding 
ON embeddings USING hnsw (embedding vector_cosine_ops);

-- Create knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    language VARCHAR(2) DEFAULT 'en',
    tags TEXT[],
    url TEXT,
    embedding VECTOR(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_category_language 
ON knowledge_base (category, language);

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
ON knowledge_base USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_tags 
ON knowledge_base USING gin (tags);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update timestamps
CREATE TRIGGER update_embeddings_updated_at 
    BEFORE UPDATE ON embeddings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at 
    BEFORE UPDATE ON knowledge_base 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial knowledge base entries for testing
INSERT INTO knowledge_base (title, content, category, language, tags) VALUES 
(
    'What is an A-Number?',
    'An A-Number (Alien Registration Number) is a unique 7, 8, or 9-digit number assigned to a noncitizen by U.S. Citizenship and Immigration Services (USCIS). This number is also called an Alien Registration Number or "USCIS Number" on some forms. You can find your A-Number on immigration documents such as your Green Card, EAD card, or immigration court documents.',
    'immigration-basics',
    'en',
    ARRAY['A-number', 'alien-registration-number', 'USCIS', 'green-card']
),
(
    '¿Qué es un Número A?',
    'Un Número A (Número de Registro de Extranjero) es un número único de 7, 8 o 9 dígitos asignado a un no ciudadano por los Servicios de Ciudadanía e Inmigración de EE.UU. (USCIS). Este número también se llama Número de Registro de Extranjero o "Número de USCIS" en algunos formularios. Puede encontrar su Número A en documentos de inmigración como su Tarjeta Verde, tarjeta EAD o documentos de la corte de inmigración.',
    'immigration-basics',
    'es',
    ARRAY['numero-a', 'registro-extranjero', 'USCIS', 'tarjeta-verde']
),
(
    'What is Form I-94?',
    'Form I-94 is the Arrival/Departure Record that documents the arrival of noncitizens to the United States. It shows your admission category, date of entry, and authorized period of stay. Since 2013, most I-94 records are electronic and can be accessed online at cbp.gov/I94. Paper I-94 forms are still issued at some land border crossings.',
    'forms-documents',
    'en',
    ARRAY['I-94', 'arrival-departure-record', 'CBP', 'entry-record']
),
(
    'Comment obtenir une carte verte?',
    'Une carte verte (carte de résident permanent) peut être obtenue par plusieurs voies : parrainage familial, offre d''emploi, statut de réfugié ou d''asile, loterie de diversité, ou investissement. Le processus implique généralement de déposer une pétition, d''attendre l''approbation, puis de demander l''ajustement de statut ou le traitement consulaire.',
    'immigration-pathways',
    'fr',
    ARRAY['carte-verte', 'resident-permanent', 'parrainage', 'emploi']
),
(
    'كيفية الحصول على البطاقة الخضراء',
    'يمكن الحصول على البطاقة الخضراء (بطاقة الإقامة الدائمة) من خلال عدة طرق: الكفالة العائلية، عرض العمل، وضع اللاجئ أو طالب اللجوء، قرعة التنوع، أو الاستثمار. تتضمن العملية عادة تقديم التماس، انتظار الموافقة، ثم طلب تعديل الوضع أو المعالجة الق领سية.',
    'immigration-pathways',
    'ar',
    ARRAY['البطاقة-الخضراء', 'الإقامة-الدائمة', 'الكفالة', 'العمل']
);

-- Create a view for search statistics
CREATE OR REPLACE VIEW embedding_stats AS
SELECT 
    collection,
    language,
    COUNT(*) as count,
    AVG(array_length(embedding, 1)) as avg_dimensions,
    MAX(created_at) as last_updated
FROM embeddings 
GROUP BY collection, language;

-- Translation Jobs Tables for Module 13 Certified Translation Assistant

-- Translation jobs table
CREATE TABLE IF NOT EXISTS translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_path TEXT,
    source_language VARCHAR(2) NOT NULL,
    target_language VARCHAR(2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    document_type VARCHAR(100),
    word_count INTEGER DEFAULT 0,
    segment_count INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    certification_required BOOLEAN DEFAULT true,
    certification_template_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE
);

-- Translation segments table for CAT editor
CREATE TABLE IF NOT EXISTS translation_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES translation_jobs(id) ON DELETE CASCADE,
    segment_number INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    target_text TEXT,
    status VARCHAR(50) DEFAULT 'new',
    locked BOOLEAN DEFAULT false,
    tm_match_score DECIMAL(5,2),
    tm_source_text TEXT,
    quality_score DECIMAL(5,2),
    comments TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(job_id, segment_number)
);

-- Translation Memory table
CREATE TABLE IF NOT EXISTS translation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    source_language VARCHAR(2) NOT NULL,
    target_language VARCHAR(2) NOT NULL,
    domain VARCHAR(100) DEFAULT 'immigration',
    quality_score DECIMAL(5,2) DEFAULT 1.00,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(source_text::bytea), 'hex')) STORED,
    UNIQUE(source_hash, source_language, target_language)
);

-- Glossary terms table
CREATE TABLE IF NOT EXISTS glossary_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_term TEXT NOT NULL,
    target_term TEXT NOT NULL,
    source_language VARCHAR(2) NOT NULL,
    target_language VARCHAR(2) NOT NULL,
    domain VARCHAR(100) DEFAULT 'immigration',
    definition TEXT,
    context TEXT,
    approved BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_term, source_language, target_language, domain)
);

-- USCIS certification templates
CREATE TABLE IF NOT EXISTS certification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    source_language VARCHAR(2) NOT NULL,
    target_language VARCHAR(2) NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    uscis_compliant BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation audit log
CREATE TABLE IF NOT EXISTS translation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES translation_jobs(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES translation_segments(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for translation tables
CREATE INDEX IF NOT EXISTS idx_translation_jobs_user_status ON translation_jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_language_pair ON translation_jobs (source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_created_at ON translation_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_translation_segments_job_status ON translation_segments (job_id, status);
CREATE INDEX IF NOT EXISTS idx_translation_segments_number ON translation_segments (job_id, segment_number);

CREATE INDEX IF NOT EXISTS idx_tm_language_pair ON translation_memory (source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_tm_source_hash ON translation_memory (source_hash);
CREATE INDEX IF NOT EXISTS idx_tm_last_used ON translation_memory (last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_glossary_language_pair ON glossary_terms (source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_glossary_domain ON glossary_terms (domain);
CREATE INDEX IF NOT EXISTS idx_glossary_approved ON glossary_terms (approved) WHERE approved = true;

CREATE INDEX IF NOT EXISTS idx_certification_templates_type_lang ON certification_templates (template_type, source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_certification_templates_active ON certification_templates (active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_audit_job_timestamp ON translation_audit (job_id, timestamp DESC);

-- Add triggers for translation tables
CREATE TRIGGER update_translation_jobs_updated_at 
    BEFORE UPDATE ON translation_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translation_segments_updated_at 
    BEFORE UPDATE ON translation_segments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translation_memory_updated_at 
    BEFORE UPDATE ON translation_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_glossary_terms_updated_at 
    BEFORE UPDATE ON glossary_terms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certification_templates_updated_at 
    BEFORE UPDATE ON certification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default USCIS certification templates
INSERT INTO certification_templates (name, template_type, source_language, target_language, template_content, variables) VALUES 
(
    'USCIS Standard Birth Certificate Translation',
    'birth_certificate',
    'es',
    'en',
    'I, {{translator_name}}, certify that I am fluent in English and {{source_language_name}}, and that the attached translation is a complete and accurate translation of the document entitled "{{document_title}}" to the best of my ability.\n\n{{translator_signature}}\n{{translator_name}}\n{{translator_address}}\n{{translation_date}}',
    '["translator_name", "source_language_name", "document_title", "translator_signature", "translator_address", "translation_date"]'::jsonb
),
(
    'USCIS Standard Marriage Certificate Translation',
    'marriage_certificate',
    'fr',
    'en',
    'I, {{translator_name}}, certify that I am fluent in English and {{source_language_name}}, and that the attached translation is a complete and accurate translation of the document entitled "{{document_title}}" to the best of my ability.\n\n{{translator_signature}}\n{{translator_name}}\n{{translator_address}}\n{{translation_date}}',
    '["translator_name", "source_language_name", "document_title", "translator_signature", "translator_address", "translation_date"]'::jsonb
),
(
    'USCIS Standard Academic Diploma Translation',
    'diploma',
    'ar',
    'en',
    'I, {{translator_name}}, certify that I am fluent in English and {{source_language_name}}, and that the attached translation is a complete and accurate translation of the document entitled "{{document_title}}" to the best of my ability.\n\n{{translator_signature}}\n{{translator_name}}\n{{translator_address}}\n{{translation_date}}',
    '["translator_name", "source_language_name", "document_title", "translator_signature", "translator_address", "translation_date"]'::jsonb
);

-- Insert sample glossary terms for immigration domain
INSERT INTO glossary_terms (source_term, target_term, source_language, target_language, domain, definition, approved) VALUES 
('certificado de nacimiento', 'birth certificate', 'es', 'en', 'immigration', 'Official document certifying the birth of a person', true),
('acta de matrimonio', 'marriage certificate', 'es', 'en', 'immigration', 'Official document certifying a marriage', true),
('pasaporte', 'passport', 'es', 'en', 'immigration', 'Official travel document', true),
('visa', 'visa', 'es', 'en', 'immigration', 'Authorization to enter a country', true),
('residente permanente', 'permanent resident', 'es', 'en', 'immigration', 'Person authorized to live permanently in a country', true),
('acte de naissance', 'birth certificate', 'fr', 'en', 'immigration', 'Document officiel certifiant la naissance', true),
('certificat de mariage', 'marriage certificate', 'fr', 'en', 'immigration', 'Document officiel certifiant un mariage', true),
('passeport', 'passport', 'fr', 'en', 'immigration', 'Document de voyage officiel', true),
('visa', 'visa', 'fr', 'en', 'immigration', 'Autorisation d''entrer dans un pays', true),
('شهادة ميلاد', 'birth certificate', 'ar', 'en', 'immigration', 'وثيقة رسمية تثبت ولادة شخص', true),
('شهادة زواج', 'marriage certificate', 'ar', 'en', 'immigration', 'وثيقة رسمية تثبت الزواج', true),
('جواز سفر', 'passport', 'ar', 'en', 'immigration', 'وثيقة سفر رسمية', true),
('تأشيرة', 'visa', 'ar', 'en', 'immigration', 'تصريح دخول إلى دولة', true);

-- Mail Processing Tables for Module 13 Addendum

-- Mail jobs for document processing pipeline
CREATE TABLE IF NOT EXISTS mail_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('upload', 'email', 'drive')),
    original_file_url TEXT NOT NULL,
    detected_lang VARCHAR(5),
    doc_type VARCHAR(50), -- uscis_notice, insurance_notice, bank_statement, credit_card_notice, utility_bill, other
    ocr_text_url TEXT,
    translation_en_url TEXT,
    translation_user_url TEXT,
    summary_en TEXT,
    summary_user TEXT,
    due_date DATE,
    amount DECIMAL(12,2),
    case_or_account_number TEXT,
    risk_flags JSONB DEFAULT '{}'::jsonb,
    confidence_scores JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL CHECK (status IN ('received', 'processing', 'needs_review', 'ready', 'error')) DEFAULT 'received',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Actionable items extracted from mail
CREATE TABLE IF NOT EXISTS mail_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_job_id UUID NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g., "Upload evidence", "Call insurer"
    description TEXT,
    due_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(10) CHECK (status IN ('todo', 'done', 'skipped')) DEFAULT 'todo',
    action_type VARCHAR(50), -- link_case, call_service, upload_document, review_amount, etc.
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Document classification training data and labels
CREATE TABLE IF NOT EXISTS mail_doc_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type VARCHAR(50) NOT NULL,
    keywords TEXT[] NOT NULL,
    embedding VECTOR(384),
    confidence_threshold DECIMAL(3,2) DEFAULT 0.75,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mail processing audit trail
CREATE TABLE IF NOT EXISTS mail_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_job_id UUID REFERENCES mail_jobs(id) ON DELETE CASCADE,
    step VARCHAR(50) NOT NULL, -- ocr, translation, classification, extraction, summarization
    status VARCHAR(20) NOT NULL,
    processing_time_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    error_details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for mail processing tables
CREATE INDEX IF NOT EXISTS idx_mail_jobs_applicant_status ON mail_jobs (applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_mail_jobs_doc_type ON mail_jobs (doc_type);
CREATE INDEX IF NOT EXISTS idx_mail_jobs_due_date ON mail_jobs (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_jobs_created_at ON mail_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_actions_job_status ON mail_actions (mail_job_id, status);
CREATE INDEX IF NOT EXISTS idx_mail_actions_due_at ON mail_actions (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_actions_priority ON mail_actions (priority, status);

CREATE INDEX IF NOT EXISTS idx_mail_doc_labels_type ON mail_doc_labels (doc_type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_mail_doc_labels_embedding ON mail_doc_labels USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_mail_audit_job_step ON mail_audit (mail_job_id, step);
CREATE INDEX IF NOT EXISTS idx_mail_audit_timestamp ON mail_audit (timestamp DESC);

-- Add triggers for mail tables
CREATE TRIGGER update_mail_jobs_updated_at 
    BEFORE UPDATE ON mail_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default document type classification labels
INSERT INTO mail_doc_labels (doc_type, keywords) VALUES 
(
    'uscis_notice',
    ARRAY['USCIS', 'U.S. Citizenship', 'Immigration Services', 'I-797', 'receipt number', 'case number', 'biometrics', 'appointment', 'green card', 'naturalization', 'petition', 'application']
),
(
    'insurance_notice',
    ARRAY['insurance', 'claim', 'EOB', 'explanation of benefits', 'deductible', 'copay', 'premium', 'policy number', 'coverage', 'medical', 'health plan']
),
(
    'bank_statement',
    ARRAY['bank statement', 'account summary', 'balance', 'deposit', 'withdrawal', 'routing number', 'account number', 'transaction', 'checking', 'savings']
),
(
    'credit_card_notice',
    ARRAY['credit card', 'minimum payment', 'due date', 'balance', 'interest', 'late fee', 'payment due', 'account number', 'statement']
),
(
    'utility_bill',
    ARRAY['utility', 'electric', 'gas', 'water', 'bill', 'service period', 'meter reading', 'usage', 'kilowatt', 'cubic feet', 'gallons']
),
(
    'tax_document',
    ARRAY['IRS', 'tax', '1099', 'W-2', 'refund', 'return', 'withholding', 'social security number', 'employer identification']
),
(
    'legal_notice',
    ARRAY['court', 'summons', 'subpoena', 'hearing', 'judgment', 'lawsuit', 'legal', 'attorney', 'plaintiff', 'defendant']
);

-- Grant necessary permissions (adjust as needed for your security requirements)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Bmore database initialized successfully with pgvector support and translation services';
END
$$;