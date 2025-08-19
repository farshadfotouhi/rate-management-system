-- Contract Data Extraction Jobs Table (simplified for file-based output)

-- Extraction jobs table
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    output_directory TEXT, -- Path to output JSON files
    total_sections INTEGER DEFAULT 0,
    completed_sections INTEGER DEFAULT 0,
    current_section VARCHAR(100),
    sections_status JSONB DEFAULT '{}', -- Track status of each section
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_tenant_id ON extraction_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_contract_id ON extraction_jobs(contract_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);

-- Add extraction status to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(50) DEFAULT 'not_started';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS last_extraction_job_id UUID REFERENCES extraction_jobs(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS extraction_output_path TEXT;