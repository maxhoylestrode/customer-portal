import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import { Upload, X, Info, FileText } from 'lucide-react';

const schema = z.object({
  title: z.string().min(5, 'Please give a clear title (at least 5 characters)'),
  description: z.string().min(20, 'Please describe the issue in detail (at least 20 characters)'),
});
type FormData = z.infer<typeof schema>;

const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

export default function NewTicketPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => {
      const fd = new FormData();
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      files.forEach((f) => fd.append('attachments', f));
      return ticketsApi.create(fd);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast('Ticket submitted successfully', 'success');
      navigate(`/tickets/${res.data.ticket.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit ticket';
      toast(msg, 'error');
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    setFileError('');

    const newFiles = [...files];
    for (const file of selected) {
      if (newFiles.length >= MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files allowed`);
        break;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setFileError(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB limit`);
        continue;
      }
      newFiles.push(file);
    }
    setFiles(newFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
  }

  return (
    <div>
      <PageHeader
        title="Submit a Ticket"
        subtitle="Describe your maintenance request and we'll get back to you."
        breadcrumb={[{ label: 'Tickets', to: '/tickets' }, { label: 'New Ticket', to: '/tickets/new' }]}
      />

      {/* Scope notice */}
      <div className="bg-[#D6EAF8] border border-[#1A5276]/20 rounded-lg p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-[#1A5276] shrink-0 mt-0.5" />
        <div className="text-sm text-[#1A5276]">
          <p className="font-semibold mb-1">What's included in your maintenance plan?</p>
          <p>Your plan covers bug fixes, minor content updates, and security patches on your existing website. Major redesigns, new features, and third-party integrations are outside scope. If in doubt, submit a ticket and we'll advise.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-5">
        <div className="card px-6 py-5 space-y-5">
          <div>
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Contact form not sending emails"
              {...register('title')}
            />
            {errors.title && <p className="error-text">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-400 mb-2">Be specific — include what's happening, where on the site, and any error messages you see.</p>
            <textarea
              rows={6}
              className="input resize-none"
              placeholder="Describe the issue in as much detail as possible…"
              {...register('description')}
            />
            {errors.description && <p className="error-text">{errors.description.message}</p>}
          </div>

          {/* File upload */}
          <div>
            <label className="label">Attachments <span className="text-gray-400 font-normal">(optional)</span></label>
            <p className="text-xs text-gray-400 mb-3">Screenshots, screen recordings, or documents. Up to {MAX_FILES} files, {MAX_SIZE_MB}MB each.</p>

            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center cursor-pointer hover:border-[#0D3040] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to upload files</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF, DOCX, TXT</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.docx,.txt"
              className="hidden"
              onChange={handleFileChange}
            />

            {fileError && <p className="error-text mt-2">{fileError}</p>}

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/tickets')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex items-center gap-2">
            {createMutation.isPending ? <Spinner className="w-4 h-4" /> : null}
            {createMutation.isPending ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
