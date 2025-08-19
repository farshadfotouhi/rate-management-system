import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  PlayArrow as ExtractIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import axios from 'axios';

interface Contract {
  id: string;
  fileName: string;
  carrierName: string;
  contractNumber?: string;
  effectiveDate?: string;
  expiryDate?: string;
  fileSize: number;
  createdAt: string;
  status: string;
  extractionStatus?: string;
  lastExtractionJobId?: string;
}

interface ExtractionJob {
  id: string;
  contractId: string;
  status: string;
  totalSections: number;
  completedSections: number;
  currentSection?: string;
  progress: number;
  tokensUsed?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  outputDirectory?: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [extractionJobs, setExtractionJobs] = useState<Map<string, ExtractionJob>>(new Map());
  const [pollingIntervals, setPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/contracts');
      setContracts(response.data.contracts);
    } catch (error) {
      console.error('Failed to load contracts:', error);
      setError('Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('contract', file);

    setUploadDialogOpen(true);
    setUploadProgress(0);
    setError('');

    try {
      const response = await axios.post('/api/contracts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percentCompleted);
        },
      });

      setSuccess('Contract uploaded successfully!');
      await loadContracts();
      setTimeout(() => {
        setUploadDialogOpen(false);
        setSuccess('');
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to upload contract');
      setTimeout(() => {
        setUploadDialogOpen(false);
      }, 3000);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleDeleteContract = async (contractId: string) => {
    if (!window.confirm('Are you sure you want to delete this contract?')) {
      return;
    }

    try {
      await axios.delete(`/api/contracts/${contractId}`);
      setSuccess('Contract deleted successfully');
      await loadContracts();
    } catch (error) {
      setError('Failed to delete contract');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const startExtraction = async (contractId: string) => {
    try {
      const response = await axios.post(`/api/extraction/contracts/${contractId}/extract`);
      const { jobId } = response.data;
      
      setSuccess('Data extraction started. This may take several minutes...');
      
      // Start polling for job status
      pollExtractionStatus(jobId, contractId);
      
      // Update contract status locally
      setContracts(prev => prev.map(c => 
        c.id === contractId 
          ? { ...c, extractionStatus: 'processing', lastExtractionJobId: jobId }
          : c
      ));
    } catch (error: any) {
      if (error.response?.data?.error === 'Extraction already in progress') {
        setError('Extraction is already in progress for this contract');
        // Poll the existing job
        if (error.response?.data?.jobId) {
          pollExtractionStatus(error.response.data.jobId, contractId);
        }
      } else {
        setError('Failed to start extraction: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const pollExtractionStatus = (jobId: string, contractId: string) => {
    // Clear any existing interval for this contract
    const existingInterval = pollingIntervals.get(contractId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Poll every 3 seconds
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/extraction/extraction-jobs/${jobId}`);
        const job: ExtractionJob = response.data;
        
        // Update job status
        setExtractionJobs(prev => new Map(prev).set(contractId, job));
        
        // Update contract status
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          // Stop polling
          clearInterval(interval);
          setPollingIntervals(prev => {
            const newMap = new Map(prev);
            newMap.delete(contractId);
            return newMap;
          });
          
          // Update contract
          setContracts(prev => prev.map(c => 
            c.id === contractId 
              ? { ...c, extractionStatus: job.status }
              : c
          ));
          
          if (job.status === 'completed') {
            setSuccess(`Extraction completed successfully! Processed ${job.completedSections} sections.`);
          } else if (job.status === 'failed') {
            setError(`Extraction failed: ${job.errorMessage || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Failed to poll extraction status:', error);
      }
    }, 3000);
    
    setPollingIntervals(prev => new Map(prev).set(contractId, interval));
  };

  const cancelExtraction = async (jobId: string, contractId: string) => {
    try {
      await axios.post(`/api/extraction/extraction-jobs/${jobId}/cancel`);
      
      // Stop polling
      const interval = pollingIntervals.get(contractId);
      if (interval) {
        clearInterval(interval);
        setPollingIntervals(prev => {
          const newMap = new Map(prev);
          newMap.delete(contractId);
          return newMap;
        });
      }
      
      // Update status
      setContracts(prev => prev.map(c => 
        c.id === contractId 
          ? { ...c, extractionStatus: 'cancelled' }
          : c
      ));
      
      setExtractionJobs(prev => {
        const newMap = new Map(prev);
        newMap.delete(contractId);
        return newMap;
      });
      
      setSuccess('Extraction cancelled');
    } catch (error: any) {
      setError('Failed to cancel extraction: ' + (error.response?.data?.error || error.message));
    }
  };

  const downloadExtractionResults = async (jobId: string, fileName?: string) => {
    try {
      const url = fileName 
        ? `/api/extraction/extraction-jobs/${jobId}/download/${fileName}`
        : `/api/extraction/extraction-jobs/${jobId}/download`;
        
      const response = await axios.get(url, {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName || 'complete_extraction.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess('Download started');
    } catch (error: any) {
      setError('Failed to download results: ' + (error.response?.data?.error || error.message));
    }
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      pollingIntervals.forEach(interval => clearInterval(interval));
    };
  }, [pollingIntervals]);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Contract Management
      </Typography>

      <Box sx={{ mb: 3 }}>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Paper
          {...getRootProps()}
          sx={{
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive
              ? 'Drop the contract here...'
              : 'Drag & drop a contract here, or click to select'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported formats: PDF, Excel (Max size: 50MB)
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} startIcon={<UploadIcon />}>
            Select File
          </Button>
        </Paper>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Carrier</TableCell>
                <TableCell>Contract #</TableCell>
                <TableCell>Effective Date</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Extraction</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No contracts uploaded yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.fileName}</TableCell>
                    <TableCell>{contract.carrierName}</TableCell>
                    <TableCell>{contract.contractNumber || '-'}</TableCell>
                    <TableCell>
                      {contract.effectiveDate
                        ? format(new Date(contract.effectiveDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {contract.expiryDate
                        ? format(new Date(contract.expiryDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{formatFileSize(contract.fileSize)}</TableCell>
                    <TableCell>
                      <Chip
                        label={contract.status}
                        color={contract.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const job = extractionJobs.get(contract.id);
                        if (job && job.status === 'processing') {
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={20} />
                              <Typography variant="caption">
                                {job.currentSection || 'Processing'} ({job.progress}%)
                              </Typography>
                            </Box>
                          );
                        } else if (contract.extractionStatus === 'completed') {
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CheckIcon color="success" fontSize="small" />
                              <Typography variant="caption" color="success.main">
                                Completed
                              </Typography>
                            </Box>
                          );
                        } else if (contract.extractionStatus === 'failed') {
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ErrorIcon color="error" fontSize="small" />
                              <Typography variant="caption" color="error.main">
                                Failed
                              </Typography>
                            </Box>
                          );
                        } else {
                          return (
                            <Typography variant="caption" color="text.secondary">
                              Not started
                            </Typography>
                          );
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(contract.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell align="right">
                      {(() => {
                        const job = extractionJobs.get(contract.id);
                        if (job && job.status === 'processing') {
                          return (
                            <IconButton
                              size="small"
                              title="Cancel Extraction"
                              onClick={() => cancelExtraction(job.id, contract.id)}
                              color="warning"
                            >
                              <StopIcon />
                            </IconButton>
                          );
                        } else if (contract.extractionStatus === 'completed' && contract.lastExtractionJobId) {
                          return (
                            <>
                              <IconButton
                                size="small"
                                title="Download Extraction Results"
                                onClick={() => downloadExtractionResults(contract.lastExtractionJobId!)}
                                color="success"
                              >
                                <DownloadIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Re-extract Data"
                                onClick={() => startExtraction(contract.id)}
                                color="primary"
                              >
                                <ExtractIcon />
                              </IconButton>
                            </>
                          );
                        } else {
                          return (
                            <IconButton
                              size="small"
                              title="Extract Data"
                              onClick={() => startExtraction(contract.id)}
                              color="primary"
                            >
                              <ExtractIcon />
                            </IconButton>
                          );
                        }
                      })()}
                      <IconButton size="small" title="View">
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Delete"
                        onClick={() => handleDeleteContract(contract.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={uploadDialogOpen} maxWidth="sm" fullWidth>
        <DialogTitle>Uploading Contract</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              {uploadProgress}% Complete
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}