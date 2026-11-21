"use client";
import { useQueryClient } from '@tanstack/react-query';
import { ReportWizard, type ReportInput } from './ReportWizard';
import { PhotoActions } from '../../components/camera/PhotoActions';
import { PhotoSuggestions } from '../../components/report/PhotoSuggestions';
import { createReport } from '../../lib/reports';

export function ReportPage() {
  const qc = useQueryClient();
  const submit = async (data: ReportInput, key: string) => {
    const res = await createReport(data, key);
    void qc.invalidateQueries({ queryKey: ['my-reports'] });
    return res;
  };
  return (
    <ReportWizard
      onSubmit={submit}
      photoExtras={(add, disabled) => <PhotoActions onFiles={add} disabled={disabled} />}
      photoSuggestions={(ctx) => <PhotoSuggestions {...ctx} />}
    />
  );
}
