import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (files: File[]) => void;
  acceptedFormats: string[];
  maxFiles?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUpload,
  acceptedFormats,
  maxFiles = 5
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedFormats.includes(extension);
    });

    if (validFiles.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles = [...selectedFiles, ...validFiles].slice(0, maxFiles);
    setSelectedFiles(newFiles);
  }, [selectedFiles, acceptedFormats, maxFiles]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = useCallback(() => {
    if (selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
      setSelectedFiles([]);
    }
  }, [selectedFiles, onFileUpload]);

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'nc':
      case 'netcdf':
        return '🌐';
      case 'grib':
      case 'grb':
      case 'grib2':
        return '🌪️';
      case 'hdf':
      case 'hdf4':
      case 'hdf5':
        return '📊';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-uploader">
      <motion.div
        className={`upload-zone clay-inset ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <input
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={handleChange}
          className="file-input"
          id="file-upload"
        />
        
        <label htmlFor="file-upload" className="upload-label">
          <motion.div
            className="upload-icon"
            animate={dragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
          >
            <Upload size={48} />
          </motion.div>
          
          <div className="upload-text">
            <h3>Upload Weather Data Files</h3>
            <p>
              Drag and drop files here, or <span className="upload-link">browse</span>
            </p>
            <p className="upload-formats">
              Supported: {acceptedFormats.join(', ')}
            </p>
          </div>
        </label>
      </motion.div>

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            className="selected-files glass-surface"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h4 className="files-header">
              Selected Files ({selectedFiles.length}/{maxFiles})
            </h4>
            
            <div className="files-list">
              {selectedFiles.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  className="file-item clay-surface"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="file-icon">
                    {getFileIcon(file.name)}
                  </div>
                  
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  
                  <div className="file-status">
                    <CheckCircle className="status-icon success" size={16} />
                  </div>
                  
                  <motion.button
                    className="remove-file glass-button"
                    onClick={() => removeFile(index)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={16} />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            <motion.button
              className="upload-button clay-button primary"
              onClick={uploadFiles}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={selectedFiles.length === 0}
            >
              Process {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};