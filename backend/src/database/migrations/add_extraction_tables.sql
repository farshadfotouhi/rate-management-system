-- Contract Data Extraction Tables

-- Extraction jobs table
CREATE TABLE extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    extraction_schema JSONB NOT NULL, -- The extraction schema/instructions
    total_sections INTEGER DEFAULT 0,
    completed_sections INTEGER DEFAULT 0,
    current_section VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extraction results per section
CREATE TABLE extraction_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
    section_name VARCHAR(100) NOT NULL,
    sheet_name VARCHAR(100),
    record_type VARCHAR(50), -- single, rows, derived
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    prompt_sent TEXT,
    response_received TEXT,
    extracted_data JSONB,
    validation_errors JSONB,
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    attempt_number INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consolidated extraction data (final output)
CREATE TABLE extraction_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    data JSONB NOT NULL, -- Complete extracted data
    validation_status VARCHAR(50), -- valid, warnings, errors
    validation_report JSONB,
    is_current BOOLEAN DEFAULT true, -- Latest version for this contract
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_extraction_jobs_tenant_id ON extraction_jobs(tenant_id);
CREATE INDEX idx_extraction_jobs_contract_id ON extraction_jobs(contract_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_results_job_id ON extraction_results(job_id);
CREATE INDEX idx_extraction_results_section ON extraction_results(section_name);
CREATE INDEX idx_extraction_data_contract_id ON extraction_data(contract_id);
CREATE INDEX idx_extraction_data_tenant_id ON extraction_data(tenant_id);

-- Add extraction status to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(50) DEFAULT 'not_started';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS last_extraction_job_id UUID REFERENCES extraction_jobs(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS extracted_data_id UUID REFERENCES extraction_data(id);