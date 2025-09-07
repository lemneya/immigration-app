/**
 * Mail Document Processing Page
 * Upload and understand your important mail documents
 */

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslations } from 'next-intl';
import Layout from '../components/Layout';

interface MailJob {
  id: string;
  status: 'received' | 'processing' | 'ready' | 'error';
  doc_type?: string;
  summary_en?: string;
  due_date?: string;
  amount?: number;
  actions: Array<{
    id: string;
    label: string;
    description: string;
    due_at?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'todo' | 'done' | 'skipped';
    action_type: string;
  }>;
  risk_flags?: {
    potential_scam?: boolean;
    risk_score?: number;
  };
}

export default function MailPage() {
  const t = useTranslations('mail');
  const router = useRouter();
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentJob, setCurrentJob] = useState<MailJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentJobs, setRecentJobs] = useState<MailJob[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicant_id', '00000000-0000-0000-0000-000000000000'); // Demo user
      formData.append('source', 'upload');
      formData.append('user_language', router.locale || 'en');

      const response = await fetch('/api/mail/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Start polling for results
      pollJobStatus(result.job_id);
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [router.locale]);

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    setIsProcessing(true);
    
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/mail/${jobId}`);
        if (response.ok) {
          const job: MailJob = await response.json();
          
          if (job.status === 'ready' || job.status === 'error') {
            setCurrentJob(job);
            setIsProcessing(false);
            
            // Add to recent jobs
            setRecentJobs(prev => [job, ...prev.slice(0, 4)]);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setIsProcessing(false);
          alert('Processing is taking longer than expected. Please check back later.');
        }
      } catch (error) {
        console.error('Polling error:', error);
        setIsProcessing(false);
      }
    };

    poll();
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Could not access camera. Please use file upload instead.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          handleFileUpload(file);
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  // Action handlers
  const markActionComplete = async (jobId: string, actionId: string) => {
    try {
      const response = await fetch(`/api/mail/${jobId}/actions/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
      });

      if (response.ok) {
        // Update local state
        setCurrentJob(prev => prev ? {
          ...prev,
          actions: prev.actions.map(action => 
            action.id === actionId ? { ...action, status: 'done' } : action
          )
        } : null);
      }
    } catch (error) {
      console.error('Failed to update action:', error);
    }
  };

  const getDocTypeIcon = (docType?: string) => {
    switch (docType) {
      case 'uscis_notice': return '🏛️';
      case 'insurance_notice': return '🏥';
      case 'bank_statement': return '🏦';
      case 'credit_card_notice': return '💳';
      case 'utility_bill': return '⚡';
      case 'tax_document': return '📊';
      case 'legal_notice': return '⚖️';
      default: return '📄';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              📬 {t('title', 'Understand Your Mail')}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('subtitle', 'Snap a photo or upload your important documents. We\'ll translate, analyze, and explain what you need to do in plain language.')}
            </p>
            
            {/* Disclaimer */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 text-sm text-blue-800">
              <strong>📝 Note:</strong> This is not legal advice. Always consult with qualified professionals for official guidance.
            </div>
          </div>

          {/* Upload Section */}
          {!currentJob && !isProcessing && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-6 text-center">
                {t('upload.title', 'Upload Your Document')}
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {/* Camera Button */}
                <button
                  onClick={startCamera}
                  disabled={isUploading}
                  className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  📷 {t('upload.camera', 'Take Photo')}
                </button>
                
                {/* File Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  📁 {t('upload.file', 'Choose File')}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />

              {uploadedFile && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">
                    ✅ Uploaded: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                </div>
              )}

              {isUploading && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                </div>
              )}
            </div>
          )}

          {/* Camera Modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Take Photo</h3>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg mb-4"
                  style={{ maxHeight: '300px' }}
                />
                <canvas ref={canvasRef} className="hidden" />
                
                <div className="flex gap-4">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    📸 Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Processing Your Document</h2>
              <p className="text-gray-600">
                We're reading, translating, and analyzing your document. This usually takes 10-30 seconds.
              </p>
              <div className="mt-4 space-y-2 text-sm text-gray-500">
                <div>✅ OCR Text Extraction</div>
                <div>🔍 Language Detection & Translation</div>
                <div>🧠 AI Document Analysis</div>
                <div>📝 Plain-Language Summary</div>
              </div>
            </div>
          )}

          {/* Results */}
          {currentJob && (
            <div className="space-y-6">
              {/* Risk Warning */}
              {currentJob.risk_flags?.potential_scam && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">⚠️</div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-800">Potential Scam Detected</h3>
                      <p className="text-red-700">
                        This document has suspicious characteristics. Be very careful before taking any action or providing personal information.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Summary */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="text-3xl mr-3">{getDocTypeIcon(currentJob.doc_type)}</div>
                  <div>
                    <h2 className="text-xl font-semibold">Document Summary</h2>
                    <p className="text-gray-600 capitalize">{currentJob.doc_type?.replace('_', ' ')}</p>
                  </div>
                </div>
                
                {currentJob.summary_en && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <p className="text-blue-900 leading-relaxed">{currentJob.summary_en}</p>
                  </div>
                )}

                {/* Key Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentJob.due_date && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <strong className="text-yellow-800">📅 Due Date:</strong>
                      <p className="text-yellow-900">{new Date(currentJob.due_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  
                  {currentJob.amount && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <strong className="text-green-800">💰 Amount:</strong>
                      <p className="text-green-900">${currentJob.amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Items */}
              {currentJob.actions && currentJob.actions.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">📋 What You Need To Do</h3>
                  
                  <div className="space-y-3">
                    {currentJob.actions.map((action) => (
                      <div
                        key={action.id}
                        className={`flex items-center p-4 rounded-lg border ${
                          action.status === 'done' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => markActionComplete(currentJob.id, action.id)}
                          className={`w-6 h-6 rounded-full border-2 mr-4 flex-shrink-0 flex items-center justify-center ${
                            action.status === 'done'
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {action.status === 'done' && '✓'}
                        </button>
                        
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium ${
                              action.status === 'done' ? 'text-green-800 line-through' : 'text-gray-900'
                            }`}>
                              {action.label}
                            </h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(action.priority)}`}>
                              {action.priority}
                            </span>
                          </div>
                          
                          <p className={`text-sm ${
                            action.status === 'done' ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {action.description}
                          </p>
                          
                          {action.due_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Due: {new Date(action.due_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Upload Button */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setCurrentJob(null);
                    setUploadedFile(null);
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  📬 Process Another Document
                </button>
              </div>
            </div>
          )}

          {/* Recent Jobs */}
          {recentJobs.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
              <h3 className="text-lg font-semibold mb-4">📂 Recent Documents</h3>
              
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setCurrentJob(job)}
                  >
                    <div className="text-2xl mr-3">{getDocTypeIcon(job.doc_type)}</div>
                    <div className="flex-grow">
                      <p className="font-medium capitalize">{job.doc_type?.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-600">
                        {job.actions.filter(a => a.status === 'todo').length} pending actions
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {job.status === 'ready' ? '✅' : '⏳'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      messages: (await import(`../messages/${locale}.json`)).default
    }
  };
}