import { v4 as uuidv4 } from 'uuid';
import { query } from '../database';
import { pineconeAssistantService } from './pinecone-assistant.service';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// The extraction schema provided by the corporation
const EXTRACTION_SCHEMA = {
  "version": "1.0-task-centric",
  "date_format": "YYYY-MM-DD",
  "currency_format": "ISO-4217",
  "unlocode_format": "^[A-Z]{5}$",
  "extraction_tasks": [
    {
      "section": "ContractHeader",
      "sheet": "ContractHeader",
      "record_type": "single",
      "keys": ["ContractNumber", "AmendmentNumber"],
      "instruction": "Find contract-level metadata near the top or in the preamble. Prefer clearly labeled fields. Normalize dates to YYYY-MM-DD.",
      "fields": [
        {"name": "CarrierName", "type": "string", "required": true, "example": "MAERSK"},
        {"name": "ContractNumber", "type": "string", "required": true, "aliases": ["Service Contract No", "SC No"], "example": "SC123456"},
        {"name": "AmendmentNumber", "type": "string", "required": false, "default": "0", "example": "1"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-01-01"},
        {"name": "ExpirationDate", "type": "date", "required": false, "example": "2025-12-31"},
        {"name": "ShipperName", "type": "string", "required": false, "example": "Russell Ltd."},
        {"name": "ShipperAddress", "type": "string", "required": false, "example": "123 Example Rd, London, UK"},
        {"name": "Scope", "type": "string", "required": false, "example": "Asia to USWC"},
        {"name": "TariffReferences", "type": "string", "required": false, "example": "Rules Tariff XYZ-100"},
        {"name": "ServiceMode", "type": "string", "required": false, "enum": ["CY/CY", "CFS/CY", "CY/CFS", "Door/CY", "Door/Door", "Other"], "example": "CY/CY"},
        {"name": "Currency", "type": "string", "required": true, "pattern": "^[A-Z]{3}$", "example": "USD"},
        {"name": "Notes", "type": "string", "required": false, "example": "Includes general rules per tariff."}
      ]
    },
    {
      "section": "BaseRates",
      "sheet": "BaseRate",
      "record_type": "rows",
      "keys": ["GroupCode", "OriginUNLOCODE", "DestinationUNLOCODE", "Equipment", "Commodity", "EffectiveDate"],
      "instruction": "Extract one row per Origin–Destination–Equipment–Commodity–Effective window. Split multi-equipment lines into multiple rows. Prefer explicit UN/LOCODEs; if only city/country given, include those and leave UN/LOCODE blank for later lookup.",
      "fields": [
        {"name": "GroupCode", "type": "string", "required": true, "example": "NA-CHN-01"},
        {"name": "OriginCity", "type": "string", "required": false, "example": "Shanghai"},
        {"name": "OriginState", "type": "string", "required": false, "example": ""},
        {"name": "OriginCountry", "type": "string", "required": false, "example": "China"},
        {"name": "OriginUNLOCODE", "type": "string", "required": true, "pattern": "^[A-Z]{5}$", "example": "CNSHA"},
        {"name": "DestinationCity", "type": "string", "required": false, "example": "Los Angeles"},
        {"name": "DestinationState", "type": "string", "required": false, "example": "CA"},
        {"name": "DestinationCountry", "type": "string", "required": false, "example": "United States"},
        {"name": "DestinationUNLOCODE", "type": "string", "required": true, "pattern": "^[A-Z]{5}$", "example": "USLAX"},
        {"name": "Equipment", "type": "string", "required": true, "enum": ["20", "40", "40HC", "45", "Other"], "example": "40HC"},
        {"name": "Commodity", "type": "string", "required": true, "aliases": ["FAK", "HS Code", "Description"], "example": "FAK"},
        {"name": "RateBasis", "type": "string", "required": true, "enum": ["PER_CONTAINER", "PER_WM", "OTHER"], "example": "PER_CONTAINER"},
        {"name": "BaseRateAmount", "type": "number", "required": true, "min": 0, "example": 1200},
        {"name": "Currency", "type": "string", "required": true, "pattern": "^[A-Z]{3}$", "example": "USD"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-01-01"},
        {"name": "ExpirationDate", "type": "date", "required": false, "example": "2025-03-31"},
        {"name": "MQC", "type": "number", "required": false, "min": 0, "example": 50},
        {"name": "ServiceMode", "type": "string", "required": false, "example": "CY/CY"},
        {"name": "NamedAccount", "type": "string", "required": false, "example": "Russell Ltd."},
        {"name": "Notes", "type": "string", "required": false, "example": "Promo rate Jan–Mar."}
      ]
    },
    {
      "section": "OriginArb",
      "sheet": "OriginArb",
      "record_type": "rows",
      "keys": ["GroupCode", "OriginUNLOCODE", "Equipment", "ChargeName", "EffectiveDate"],
      "instruction": "Extract origin-side arbitraries and pre-carriage inland charges. If only city/country present, include them and leave UN/LOCODE blank.",
      "fields": [
        {"name": "GroupCode", "type": "string", "required": true, "example": "NA-CHN-01"},
        {"name": "OriginCity", "type": "string", "required": false, "example": "Shanghai"},
        {"name": "OriginState", "type": "string", "required": false, "example": ""},
        {"name": "OriginCountry", "type": "string", "required": false, "example": "China"},
        {"name": "OriginUNLOCODE", "type": "string", "required": true, "pattern": "^[A-Z]{5}$", "example": "CNSHA"},
        {"name": "Equipment", "type": "string", "required": true, "example": "40HC"},
        {"name": "ChargeName", "type": "string", "required": true, "example": "Inland Haulage"},
        {"name": "Amount", "type": "number", "required": true, "min": 0, "example": 250},
        {"name": "Currency", "type": "string", "required": true, "pattern": "^[A-Z]{3}$", "example": "USD"},
        {"name": "Basis", "type": "string", "required": true, "enum": ["PER_CONTAINER", "PER_WM", "PER_BL", "OTHER"], "example": "PER_CONTAINER"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-01-01"},
        {"name": "ExpirationDate", "type": "date", "required": false, "example": "2025-03-31"},
        {"name": "Notes", "type": "string", "required": false, "example": ""}
      ]
    },
    {
      "section": "DestinationArb",
      "sheet": "DestinationArb",
      "record_type": "rows",
      "keys": ["GroupCode", "DestinationUNLOCODE", "Equipment", "ChargeName", "EffectiveDate"],
      "instruction": "Extract destination-side arbitraries and on-carriage inland charges. If only city/country present, include them and leave UN/LOCODE blank.",
      "fields": [
        {"name": "GroupCode", "type": "string", "required": true, "example": "NA-CHN-01"},
        {"name": "DestinationCity", "type": "string", "required": false, "example": "Los Angeles"},
        {"name": "DestinationState", "type": "string", "required": false, "example": "CA"},
        {"name": "DestinationCountry", "type": "string", "required": false, "example": "United States"},
        {"name": "DestinationUNLOCODE", "type": "string", "required": true, "pattern": "^[A-Z]{5}$", "example": "USLAX"},
        {"name": "Equipment", "type": "string", "required": true, "example": "40HC"},
        {"name": "ChargeName", "type": "string", "required": true, "example": "On-Carriage"},
        {"name": "Amount", "type": "number", "required": true, "min": 0, "example": 300},
        {"name": "Currency", "type": "string", "required": true, "pattern": "^[A-Z]{3}$", "example": "USD"},
        {"name": "Basis", "type": "string", "required": true, "enum": ["PER_CONTAINER", "PER_WM", "PER_BL", "OTHER"], "example": "PER_CONTAINER"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-01-01"},
        {"name": "ExpirationDate", "type": "date", "required": false, "example": "2025-03-31"},
        {"name": "Notes", "type": "string", "required": false, "example": ""}
      ]
    },
    {
      "section": "GroupCodeInfo",
      "sheet": "GroupCodeInfo",
      "record_type": "rows",
      "keys": ["GroupCode", "LocationUNLOCODE"],
      "instruction": "Create or confirm group code entries per lane location. If city/state/country given without code, include them and leave LocationUNLOCODE blank for later lookup.",
      "fields": [
        {"name": "GroupCode", "type": "string", "required": true, "example": "NA-CHN-01"},
        {"name": "LocationCity", "type": "string", "required": true, "example": "Shanghai"},
        {"name": "LocationState", "type": "string", "required": false, "example": ""},
        {"name": "LocationCountry", "type": "string", "required": true, "example": "China"},
        {"name": "LocationUNLOCODE", "type": "string", "required": true, "pattern": "^[A-Z]{5}$", "example": "CNSHA"}
      ]
    },
    {
      "section": "Surcharges",
      "sheet": "Surcharges",
      "record_type": "rows",
      "keys": ["SurchargeName", "Applicability", "Equipment", "EffectiveDate"],
      "instruction": "List every surcharge in the contract. If amount not specified and text says 'as per tariff', set AsPerTariff=true and leave numeric fields empty.",
      "fields": [
        {"name": "SurchargeName", "type": "string", "required": true, "aliases": ["BAF", "THC", "ISPS", "LSS", "PSS", "ECA", "GRI"], "example": "BAF"},
        {"name": "Applicability", "type": "string", "required": true, "enum": ["GLOBAL", "ORIGIN", "DESTINATION", "TRADE", "LANE"], "example": "GLOBAL"},
        {"name": "TradeOrLane", "type": "string", "required": false, "example": "Asia–USWC"},
        {"name": "Equipment", "type": "string", "required": false, "example": "40HC"},
        {"name": "Basis", "type": "string", "required": true, "enum": ["PER_CONTAINER", "PER_WM", "PER_BL", "PERCENT", "OTHER"], "example": "PER_CONTAINER"},
        {"name": "Amount", "type": "number", "required": false, "min": 0, "example": 200},
        {"name": "Currency", "type": "string", "required": false, "pattern": "^[A-Z]{3}$", "example": "USD"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-01-01"},
        {"name": "ExpirationDate", "type": "date", "required": false, "example": "2025-02-15"},
        {"name": "AsPerTariff", "type": "boolean", "required": false, "default": false, "example": false},
        {"name": "Notes", "type": "string", "required": false, "example": ""}
      ]
    },
    {
      "section": "Customers",
      "sheet": "Customer",
      "record_type": "rows",
      "keys": ["CustomerName"],
      "instruction": "Capture named accounts tied to commodities or clauses. Use the legal name provided.",
      "fields": [
        {"name": "CustomerName", "type": "string", "required": true, "example": "Russell Ltd."},
        {"name": "CustomerID", "type": "string", "required": false, "example": "CUST-00921"},
        {"name": "NamedAccountTag", "type": "string", "required": false, "example": "NA"}
      ]
    },
    {
      "section": "Commodity",
      "sheet": "Commodity",
      "record_type": "rows",
      "keys": ["Commodity"],
      "instruction": "List distinct commodities in the contract. Mark NamedAccount if restricted to a specific customer. Preserve original descriptions when in doubt.",
      "fields": [
        {"name": "Commodity", "type": "string", "required": true, "example": "FAK"},
        {"name": "NamedAccount", "type": "string", "required": false, "example": "Russell Ltd."},
        {"name": "SortKey", "type": "string", "required": false, "note": "Used by internal sorting (original col J).", "example": "NA_01"},
        {"name": "Notes", "type": "string", "required": false, "example": ""}
      ]
    },
    {
      "section": "Maintenance",
      "sheet": "Maintenance",
      "record_type": "single",
      "keys": ["ContractNumber", "AmendmentNumber"],
      "instruction": "Populate after preparing a new amendment. Align dates with header. Free text notes allowed.",
      "fields": [
        {"name": "ContractNumber", "type": "string", "required": true, "example": "SC123456"},
        {"name": "AmendmentNumber", "type": "string", "required": true, "example": "2"},
        {"name": "EffectiveDate", "type": "date", "required": true, "example": "2025-04-01"},
        {"name": "PreparedBy", "type": "string", "required": false, "example": "Ops Team"},
        {"name": "Notes", "type": "string", "required": false, "example": "Amendment for Q2 rates."}
      ]
    }
  ]
};

interface ExtractionJob {
  id: string;
  tenantId: string;
  contractId: string;
  userId: string;
  status: string;
  outputDirectory: string;
  totalSections: number;
  completedSections: number;
  currentSection?: string;
}

interface Contract {
  id: string;
  tenantId: string;
  carrierName: string;
  contractNumber: string;
  fileName: string;
}

export class ContractExtractionService {
  private extractionOutputDir: string;
  private activeExtractions: Set<string> = new Set();

  constructor() {
    this.extractionOutputDir = process.env.EXTRACTION_OUTPUT_DIR || './extraction-output';
    
    // Cleanup on process termination
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }
  
  private async cleanup() {
    logger.info(`Cleaning up ${this.activeExtractions.size} active extractions...`);
    // Mark all active extractions as cancelled
    for (const jobId of this.activeExtractions) {
      try {
        await this.updateJobStatus(jobId, 'cancelled', 'Server shutdown');
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.activeExtractions.clear();
  }

  async startExtraction(contractId: string, userId: string): Promise<string> {
    try {
      // Get contract details
      const [contract] = await query<Contract>(
        `SELECT id, tenant_id as "tenantId", carrier_name as "carrierName", 
                contract_number as "contractNumber", file_name as "fileName"
         FROM contracts WHERE id = $1`,
        [contractId]
      );

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Create output directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = path.join(
        this.extractionOutputDir,
        contract.tenantId,
        contractId,
        timestamp
      );
      await fs.mkdir(outputDir, { recursive: true });

      // Create extraction job
      const jobId = uuidv4();
      const totalSections = EXTRACTION_SCHEMA.extraction_tasks.length;

      await query(
        `INSERT INTO extraction_jobs (
          id, tenant_id, contract_id, user_id, status, 
          output_directory, total_sections, completed_sections, sections_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          jobId, contract.tenantId, contractId, userId, 'pending',
          outputDir, totalSections, 0, {}
        ]
      );

      // Update contract status
      await query(
        `UPDATE contracts 
         SET extraction_status = 'processing', last_extraction_job_id = $1
         WHERE id = $2`,
        [jobId, contractId]
      );

      // Track active extraction
      this.activeExtractions.add(jobId);
      
      // Start background processing
      this.processExtractionJob(jobId, contract, outputDir)
        .catch(error => {
          logger.error(`Extraction job ${jobId} failed:`, error);
          this.updateJobStatus(jobId, 'failed', error.message);
        })
        .finally(() => {
          // Remove from active extractions when done
          this.activeExtractions.delete(jobId);
        });

      logger.info(`Started extraction job ${jobId} for contract ${contractId}`);
      return jobId;

    } catch (error) {
      logger.error('Failed to start extraction:', error);
      throw error;
    }
  }

  private async processExtractionJob(
    jobId: string,
    contract: Contract,
    outputDir: string
  ): Promise<void> {
    try {
      // Update job status to processing
      await query(
        `UPDATE extraction_jobs 
         SET status = 'processing', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      );

      const extractedData: any = {
        metadata: {
          extractionJobId: jobId,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          carrierName: contract.carrierName,
          fileName: contract.fileName,
          extractionDate: new Date().toISOString(),
          schemaVersion: EXTRACTION_SCHEMA.version
        },
        sections: {}
      };

      let completedSections = 0;
      let totalTokensUsed = 0;
      const sectionsStatus: any = {};

      // Process each section sequentially
      for (const task of EXTRACTION_SCHEMA.extraction_tasks) {
        try {
          logger.info(`Processing section: ${task.section}`);
          
          // Update current section
          await query(
            `UPDATE extraction_jobs 
             SET current_section = $1, sections_status = $2
             WHERE id = $3`,
            [task.section, sectionsStatus, jobId]
          );

          // Create the prompt for this section
          const prompt = this.createExtractionPrompt(task, contract);
          
          // Send to Pinecone Assistant
          const result = await this.queryPineconeForExtraction(
            contract.tenantId,
            prompt,
            task.section
          );

          // Parse and validate the response
          const parsedData = this.parseExtractionResponse(result.response, task);
          
          // Store section data
          extractedData.sections[task.section] = parsedData;
          
          // Save individual section file
          const sectionFilePath = path.join(outputDir, `${task.section}.json`);
          await fs.writeFile(
            sectionFilePath,
            JSON.stringify(parsedData, null, 2)
          );

          completedSections++;
          totalTokensUsed += result.tokensUsed || 0;
          sectionsStatus[task.section] = 'completed';

          // Update progress
          await query(
            `UPDATE extraction_jobs 
             SET completed_sections = $1, tokens_used = $2, sections_status = $3
             WHERE id = $4`,
            [completedSections, totalTokensUsed, sectionsStatus, jobId]
          );

          // Add delay between requests to avoid rate limiting
          // Longer delay for sections that just used more tokens
          const delay = totalTokensUsed > 10000 ? 5000 : 3000;
          logger.info(`Waiting ${delay/1000}s before next section...`);
          await new Promise(resolve => setTimeout(resolve, delay));

        } catch (sectionError: any) {
          logger.error(`Failed to process section ${task.section}:`, sectionError);
          sectionsStatus[task.section] = 'failed';
          extractedData.sections[task.section] = {
            error: sectionError.message,
            status: 'failed'
          };
        }
      }

      // Save complete extraction file
      const completeFilePath = path.join(outputDir, 'complete_extraction.json');
      await fs.writeFile(
        completeFilePath,
        JSON.stringify(extractedData, null, 2)
      );

      // Create summary file
      const summaryFilePath = path.join(outputDir, 'extraction_summary.json');
      await fs.writeFile(
        summaryFilePath,
        JSON.stringify({
          jobId,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          totalSections: EXTRACTION_SCHEMA.extraction_tasks.length,
          completedSections,
          failedSections: Object.entries(sectionsStatus).filter(([_, status]) => status === 'failed').map(([section]) => section),
          totalTokensUsed,
          outputFiles: await fs.readdir(outputDir),
          completedAt: new Date().toISOString()
        }, null, 2)
      );

      // Update job and contract status
      await query(
        `UPDATE extraction_jobs 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
             completed_sections = $1, tokens_used = $2, sections_status = $3
         WHERE id = $4`,
        [completedSections, totalTokensUsed, sectionsStatus, jobId]
      );

      await query(
        `UPDATE contracts 
         SET extraction_status = 'completed', extraction_output_path = $1
         WHERE id = $2`,
        [outputDir, contract.id]
      );

      logger.info(`Extraction job ${jobId} completed successfully`);

    } catch (error: any) {
      logger.error(`Extraction job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', error.message);
      throw error;
    }
  }

  private createExtractionPrompt(task: any, contract: Contract): string {
    // Keep prompts concise but include the exact instruction
    const fieldNames = task.fields
      .filter((f: any) => f.required)
      .map((f: any) => f.name)
      .join(', ');

    let prompt = `${task.instruction}\n\n`;
    
    if (task.record_type === 'rows') {
      prompt += `Return JSON: {"rows": [{...}]}\n`;
      prompt += `Required fields: ${fieldNames}\n`;
    } else {
      prompt += `Return JSON: {...}\n`;
      prompt += `Required fields: ${fieldNames}\n`;
    }

    // Add minimal but essential rules
    prompt += `\nRules:\n`;
    prompt += `- Dates: YYYY-MM-DD\n`;
    prompt += `- Currency: 3-letter codes\n`;
    prompt += `- UN/LOCODEs: 5-letter codes\n`;
    
    // Section-specific rules
    if (task.section === 'Surcharges') {
      prompt += `- If "as per tariff": AsPerTariff=true, Amount=null\n`;
    }
    if (task.section === 'BaseRates' || task.section === 'OriginArb' || task.section === 'DestinationArb') {
      prompt += `- Equipment: 20, 40, 40HC, 45, or Other\n`;
    }
    
    prompt += `\nExtract and return valid JSON only.`;
    
    return prompt;
  }

  private async queryPineconeForExtraction(
    tenantId: string,
    prompt: string,
    section: string
  ): Promise<{ response: string; tokensUsed: number }> {
    try {
      // Get the assistant for this tenant
      const [assistant] = await query<{ id: string; pinecone_assistant_id: string }>(
        `SELECT id, pinecone_assistant_id FROM assistants 
         WHERE tenant_id = $1 AND is_active = true 
         LIMIT 1`,
        [tenantId]
      );
      
      if (!assistant) {
        // No assistant configured, use mock response
        logger.warn(`No assistant found for tenant ${tenantId}, using mock response`);
        return {
          response: JSON.stringify({
            error: `No assistant configured for tenant`,
            section: section,
            data: {}
          }),
          tokensUsed: 0
        };
      }
      
      // For extraction, we'll use direct API calls instead of the sendMessage function
      // This gives us better control over timeouts
      const startTime = Date.now();
      
      // Different timeout based on section complexity
      const timeoutMs = this.getSectionTimeout(section);
      logger.info(`Starting extraction for ${section} with ${timeoutMs/1000}s timeout`);
      
      try {
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(
          `https://prod-1-data.ke.pinecone.io/assistant/chat/${assistant.pinecone_assistant_id}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Api-Key': process.env.PINECONE_ASSISTANT_API_KEY!,
              'Content-Type': 'application/json',
              'X-Pinecone-API-Version': '2025-04',
            },
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: prompt
              }],
              model: 'gemini-2.5-pro',
              stream: false,
            }),
          }
        );
        
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        
        if (!response.ok) {
          const error = await response.text();
          logger.error(`Pinecone API error for ${section}:`, response.status, error);
          throw new Error(`API error ${response.status}: ${error}`);
        }
        
        const result = await response.json();
        logger.info(`${section} extraction completed in ${elapsed/1000}s, tokens: ${result.usage?.total_tokens || 0}`);
        
        // Extract the content from the response
        const content = result.message?.content || 
                       result.choices?.[0]?.message?.content ||
                       result.content ||
                       '';
        
        if (!content) {
          throw new Error('No content in response');
        }
        
        return {
          response: content,
          tokensUsed: result.usage?.total_tokens || 0
        };
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          logger.warn(`Timeout after ${timeoutMs/1000}s for section ${section}`);
          // Return empty structure for timeout
          return {
            response: JSON.stringify({
              error: 'Request timeout',
              section: section,
              rows: [],
              message: `Request timed out after ${timeoutMs/1000} seconds`
            }),
            tokensUsed: 0
          };
        }
        throw error;
      }

    } catch (error) {
      logger.error(`Failed to query Pinecone for section ${section}:`, error);
      // Return a fallback response if Pinecone fails
      return {
        response: JSON.stringify({
          error: `Failed to extract ${section}`,
          message: error instanceof Error ? error.message : 'Unknown error',
          rows: []
        }),
        tokensUsed: 0
      };
    }
  }
  
  private getSectionTimeout(section: string): number {
    // Generous timeouts to handle variable Pinecone API response times
    const timeouts: { [key: string]: number } = {
      'ContractHeader': 300000,   // 5 minutes
      'BaseRates': 300000,        // 5 minutes
      'OriginArb': 300000,        // 5 minutes
      'DestinationArb': 300000,   // 5 minutes
      'GroupCodeInfo': 300000,    // 5 minutes
      'Surcharges': 300000,       // 5 minutes
      'Customers': 300000,        // 5 minutes
      'Commodity': 300000,        // 5 minutes
      'Maintenance': 300000,      // 5 minutes
    };
    
    return timeouts[section] || 300000; // Default 5 minutes
  }

  private parseExtractionResponse(response: string, task: any): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        // Validate required fields
        const missingRequired: string[] = [];
        for (const field of task.fields) {
          if (field.required) {
            if (task.record_type === 'single') {
              if (!parsed[field.name]) {
                missingRequired.push(field.name);
              }
            } else if (task.record_type === 'rows') {
              // Check first row as sample
              if (parsed.rows && parsed.rows.length > 0) {
                if (!parsed.rows[0][field.name]) {
                  missingRequired.push(field.name);
                }
              }
            }
          }
        }
        
        if (missingRequired.length > 0) {
          parsed.validation_warnings = { missing_required: missingRequired };
        }
        
        return {
          section: task.section,
          sheet: task.sheet,
          record_type: task.record_type,
          data: parsed,
          extracted_at: new Date().toISOString()
        };
      }
      
      // If no JSON found, return error
      return {
        section: task.section,
        sheet: task.sheet,
        record_type: task.record_type,
        error: 'No valid JSON found in response',
        raw_response: response.substring(0, 500)
      };

    } catch (error: any) {
      logger.error(`Failed to parse extraction response for ${task.section}:`, error);
      return {
        section: task.section,
        sheet: task.sheet,
        record_type: task.record_type,
        error: error.message,
        raw_response: response.substring(0, 500)
      };
    }
  }

  private async updateJobStatus(jobId: string, status: string, errorMessage?: string): Promise<void> {
    await query(
      `UPDATE extraction_jobs 
       SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, errorMessage || null, jobId]
    );
    
    // Also update contract status
    const [job] = await query<{ contract_id: string }>(
      `SELECT contract_id FROM extraction_jobs WHERE id = $1`,
      [jobId]
    );
    
    if (job) {
      await query(
        `UPDATE contracts SET extraction_status = $1 WHERE id = $2`,
        [status === 'completed' ? 'completed' : 'failed', job.contract_id]
      );
    }
  }

  async getExtractionJob(jobId: string): Promise<any> {
    const [job] = await query(
      `SELECT 
        j.id, j.tenant_id as "tenantId", j.contract_id as "contractId",
        j.status, j.output_directory as "outputDirectory",
        j.total_sections as "totalSections", j.completed_sections as "completedSections",
        j.current_section as "currentSection", j.sections_status as "sectionsStatus",
        j.tokens_used as "tokensUsed", j.error_message as "errorMessage",
        j.started_at as "startedAt", j.completed_at as "completedAt",
        j.created_at as "createdAt",
        c.carrier_name as "carrierName", c.contract_number as "contractNumber",
        c.file_name as "fileName"
       FROM extraction_jobs j
       JOIN contracts c ON j.contract_id = c.id
       WHERE j.id = $1`,
      [jobId]
    );
    
    return job;
  }

  async getExtractionJobsByContract(contractId: string): Promise<any[]> {
    const jobs = await query(
      `SELECT 
        id, status, total_sections as "totalSections", 
        completed_sections as "completedSections", tokens_used as "tokensUsed",
        output_directory as "outputDirectory", error_message as "errorMessage",
        started_at as "startedAt", completed_at as "completedAt", created_at as "createdAt"
       FROM extraction_jobs
       WHERE contract_id = $1
       ORDER BY created_at DESC`,
      [contractId]
    );
    
    return jobs;
  }

  async cancelExtraction(jobId: string): Promise<void> {
    await this.updateJobStatus(jobId, 'cancelled');
    logger.info(`Extraction job ${jobId} cancelled`);
  }
}

export const contractExtractionService = new ContractExtractionService();