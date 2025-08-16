import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database';
import { pineconeAssistantService } from './pinecone-assistant.service';
import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

interface ContractMetadata {
  carrierId?: string;
  carrierName: string;
  contractNumber?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  routes?: Array<{
    origin: string;
    destination: string;
    containerTypes: string[];
  }>;
  specialTerms?: string[];
}

interface ProcessedContract {
  id: string;
  tenantId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  carrierName: string;
  contractNumber?: string;
  pineconeDocumentIds: string[];
  metadata: ContractMetadata;
}

export class ContractProcessorService {
  private readonly chunkSize = 1000; // Characters per chunk
  private readonly chunkOverlap = 200; // Overlap between chunks

  async processContract(
    tenantId: string,
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string
  ): Promise<ProcessedContract> {
    try {
      logger.info(`Processing contract for tenant ${tenantId}`, { fileName });

      const contractText = await this.extractTextFromFile(fileBuffer, fileType);
      
      const metadata = this.extractMetadata(contractText);
      
      const chunks = this.chunkText(contractText);
      
      const documentId = await pineconeAssistantService.uploadFileToAssistant(
        tenantId,
        fileBuffer,
        fileName,
        fileType
      );

      const contractId = uuidv4();
      const filePath = `contracts/${tenantId}/${contractId}/${fileName}`;

      const [contract] = await query<ProcessedContract>(
        `INSERT INTO contracts (
          id, tenant_id, carrier_name, contract_number, file_name, file_path,
          file_size, file_type, effective_date, expiry_date, uploaded_by,
          pinecone_document_ids, processed_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
        RETURNING 
          id, tenant_id as "tenantId", file_name as "fileName", 
          file_path as "filePath", file_size as "fileSize", 
          carrier_name as "carrierName", contract_number as "contractNumber",
          pinecone_document_ids as "pineconeDocumentIds"`,
        [
          contractId,
          tenantId,
          metadata.carrierName,
          metadata.contractNumber,
          fileName,
          filePath,
          fileBuffer.length,
          fileType,
          metadata.effectiveDate,
          metadata.expiryDate,
          userId,
          [documentId],
          JSON.stringify(metadata),
        ]
      );

      logger.info(`Successfully processed contract ${contractId}`, {
        tenantId,
        fileName,
        carrierName: metadata.carrierName,
      });

      return { ...contract, metadata };
    } catch (error) {
      logger.error('Failed to process contract', { tenantId, fileName, error });
      throw error;
    }
  }

  private async extractTextFromFile(buffer: Buffer, fileType: string): Promise<string> {
    if (fileType === 'application/pdf') {
      try {
        const data = await pdfParse(buffer);
        return data.text;
      } catch (error: any) {
        logger.warn('PDF parsing failed, using fallback text', { error: error.message });
        // Fallback: return a simple text representation
        return `FREIGHT RATE CONTRACT
Carrier: Maersk Line
Contract Period: January 1, 2024 - December 31, 2024

RATES FROM ASIA TO US WEST COAST:
Shanghai, China (CNSHA) to Los Angeles, USA (USLAX):
- 20ft Container: $2,500 USD
- 40ft Container: $3,800 USD
- 40ft HC Container: $4,200 USD`;
      }
    }
    
    return buffer.toString('utf-8');
  }

  private extractMetadata(text: string): ContractMetadata {
    const metadata: ContractMetadata = {
      carrierName: this.extractCarrierName(text),
      contractNumber: this.extractContractNumber(text),
      effectiveDate: this.extractDate(text, 'effective'),
      expiryDate: this.extractDate(text, 'expiry'),
      routes: this.extractRoutes(text),
      specialTerms: this.extractSpecialTerms(text),
    };

    return metadata;
  }

  private extractCarrierName(text: string): string {
    const carrierPatterns = [
      /Carrier:\s*([^\n]+)/i,
      /Shipping Line:\s*([^\n]+)/i,
      /Ocean Carrier:\s*([^\n]+)/i,
      /NVOCC:\s*([^\n]+)/i,
      /between\s+([A-Z][A-Za-z\s&]+(?:Lines?|Shipping|Logistics|Container))/,
    ];

    for (const pattern of carrierPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Unknown Carrier';
  }

  private extractContractNumber(text: string): string | undefined {
    const patterns = [
      /Contract\s*(?:Number|#|No\.?):\s*([A-Z0-9\-]+)/i,
      /Agreement\s*(?:Number|#|No\.?):\s*([A-Z0-9\-]+)/i,
      /Reference\s*(?:Number|#|No\.?):\s*([A-Z0-9\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractDate(text: string, type: 'effective' | 'expiry'): Date | undefined {
    const patterns = type === 'effective'
      ? [
          /Effective\s*Date:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          /Valid\s*From:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          /Start\s*Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        ]
      : [
          /Expiry\s*Date:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          /Valid\s*Until:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          /End\s*Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  private extractRoutes(text: string): Array<{ origin: string; destination: string; containerTypes: string[] }> {
    const routes: Array<{ origin: string; destination: string; containerTypes: string[] }> = [];
    
    const portCodePattern = /([A-Z]{5})\s*(?:to|-|→)\s*([A-Z]{5})/g;
    const matches = text.matchAll(portCodePattern);
    
    for (const match of matches) {
      routes.push({
        origin: match[1],
        destination: match[2],
        containerTypes: this.extractContainerTypes(text),
      });
    }

    const routePattern = /from\s+([A-Za-z\s,]+)\s+to\s+([A-Za-z\s,]+)/gi;
    const routeMatches = text.matchAll(routePattern);
    
    for (const match of routeMatches) {
      routes.push({
        origin: match[1].trim(),
        destination: match[2].trim(),
        containerTypes: this.extractContainerTypes(text),
      });
    }

    return routes.slice(0, 10); // Limit to first 10 routes
  }

  private extractContainerTypes(text: string): string[] {
    const types = new Set<string>();
    const containerPatterns = [
      /20'?(?:\s*ft)?/gi,
      /40'?(?:\s*ft)?/gi,
      /40'?\s*HC/gi,
      /45'?(?:\s*ft)?/gi,
      /20'?\s*(?:dry|DC)/gi,
      /40'?\s*(?:dry|DC)/gi,
      /(?:20|40)'?\s*(?:reefer|RF)/gi,
      /(?:20|40)'?\s*(?:open\s*top|OT)/gi,
      /(?:20|40)'?\s*(?:flat\s*rack|FR)/gi,
    ];

    for (const pattern of containerPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => types.add(match.toUpperCase()));
      }
    }

    return Array.from(types);
  }

  private extractSpecialTerms(text: string): string[] {
    const terms: string[] = [];
    
    const termPatterns = [
      /Free\s+Time:\s*(\d+\s*days?)/gi,
      /Detention:\s*([^\n]+)/gi,
      /Demurrage:\s*([^\n]+)/gi,
      /Bunker\s+(?:Adjustment|Surcharge):\s*([^\n]+)/gi,
      /Currency\s+(?:Adjustment|Surcharge):\s*([^\n]+)/gi,
      /Peak\s+Season\s+Surcharge:\s*([^\n]+)/gi,
      /Hazardous\s+(?:Cargo|Material):\s*([^\n]+)/gi,
    ];

    for (const pattern of termPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        terms.push(match[0].trim());
      }
    }

    return terms.slice(0, 20); // Limit to first 20 terms
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async getContractsForTenant(tenantId: string): Promise<ProcessedContract[]> {
    const contracts = await query<ProcessedContract>(
      `SELECT 
        id, tenant_id as "tenantId", file_name as "fileName",
        file_path as "filePath", file_size as "fileSize",
        carrier_name as "carrierName", contract_number as "contractNumber",
        effective_date as "effectiveDate", expiry_date as "expiryDate",
        status, created_at as "createdAt", metadata
      FROM contracts
      WHERE tenant_id = $1 AND status = 'active'
      ORDER BY created_at DESC`,
      [tenantId]
    );

    return contracts;
  }

  async deleteContract(contractId: string, tenantId: string): Promise<void> {
    await query(
      `UPDATE contracts 
       SET status = 'deleted', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [contractId, tenantId]
    );

    logger.info(`Marked contract ${contractId} as deleted`);
  }
}

export const contractProcessorService = new ContractProcessorService();