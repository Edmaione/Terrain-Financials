'use client'

import { useState } from 'react'
import { parseCSV } from '@/lib/csv-parser'
import { ParsedTransaction } from '@/types'

export default function CSVUploader() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const debugIngest = process.env.NEXT_PUBLIC_INGEST_DEBUG === 'true'
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith('.csv')
    )
    
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles)
      handleParse(droppedFiles)
    }
  }
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)
      handleParse(selectedFiles)
    }
  }
  
  const handleParse = async (filesToParse: File[]) => {
    setError(null)
    setParsedData([])
    
    try {
      const allTransactions: ParsedTransaction[] = []
      
      for (const file of filesToParse) {
        const transactions = await parseCSV(file)
        allTransactions.push(...transactions)
      }
      
      if (debugIngest) {
        console.info('[ingest] Parsed transactions', {
          fileCount: filesToParse.length,
          parsedCount: allTransactions.length,
          sample: allTransactions.slice(0, 3),
        })
      }

      setParsedData(allTransactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }
  
  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/upload/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: parsedData,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Upload failed')
      }
      
      const result = await response.json()
      
      // Show success message and redirect
      alert(`Success! Imported ${result.imported_count} transactions. ${result.duplicate_count} duplicates skipped.`)
      window.location.href = '/transactions?reviewed=false'
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Drag and Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-primary-600 font-medium hover:text-primary-500">
                Upload CSV files
              </span>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".csv"
                onChange={handleFileInput}
              />
            </label>
            <p className="text-gray-500"> or drag and drop</p>
          </div>
          
          <p className="text-xs text-gray-500">
            CSV files from Relay, Chase, Bank of America, or any bank
          </p>
        </div>
      </div>
      
      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">Selected Files:</h3>
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">{file.name}</span>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
      {/* Parsed Data Preview */}
      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Parsed {parsedData.length} transactions
            </h3>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Import Transactions'}
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.slice(0, 50).map((transaction, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {transaction.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {transaction.payee}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {transaction.description}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                        transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 50 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing first 50 of {parsedData.length} transactions
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
