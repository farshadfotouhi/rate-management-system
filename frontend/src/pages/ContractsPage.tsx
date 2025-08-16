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
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
                <TableCell>Uploaded</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
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
                      {format(new Date(contract.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="View">
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small" title="Download">
                        <DownloadIcon />
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