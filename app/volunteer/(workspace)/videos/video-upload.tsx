'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

const MAX = 60 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** A frame ~1 s in (or the middle of short clips) as a JPEG thumbnail — made in the browser. */
async function captureThumbnail(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    const scale = Math.min(1, 640 / (video.videoWidth || 640));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((video.videoWidth || 640) * scale);
    canvas.height = Math.round((video.videoHeight || 360) * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VideoUpload() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<{ blob: Blob; url: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function choose(next: File | undefined) {
    setMessage(null);
    if (thumb) URL.revokeObjectURL(thumb.url);
    setThumb(null);
    setFile(null);
    if (!next) return;
    if (next.type && !TYPES.includes(next.type)) return setMessage({ ok: false, text: 'Use an MP4, WebM or MOV video.' });
    if (next.size > MAX) return setMessage({ ok: false, text: `This video is ${(next.size / 1024 / 1024).toFixed(0)} MB — the limit is 60 MB. Trim it or record a shorter clip.` });
    setFile(next);
    const blob = await captureThumbnail(next);
    if (blob) setThumb({ blob, url: URL.createObjectURL(blob) });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setMessage({ ok: false, text: 'Choose a video first.' });
    const form = new FormData(e.currentTarget);
    form.set('video', file, file.name);
    if (thumb) form.set('thumbnail', thumb.blob, 'thumbnail.jpg');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/volunteer/videos');
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onerror = () => {
      setProgress(null);
      setMessage({ ok: false, text: 'Upload failed — check your internet and try again.' });
    };
    xhr.onload = () => {
      setProgress(null);
      let body: { success?: boolean; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (body.success) {
        setMessage({ ok: true, text: 'Uploaded. An admin will review it before farmers can see it.' });
        formRef.current?.reset();
        setFile(null);
        if (thumb) URL.revokeObjectURL(thumb.url);
        setThumb(null);
        router.refresh();
      } else setMessage({ ok: false, text: body.error?.message ?? 'Upload failed. Please try again.' });
    };
    setProgress(0);
    xhr.send(form);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-[var(--crop-cream)] p-6 text-center transition-colors hover:border-[var(--crop-green-500)]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={thumb.url} alt="" className="aspect-video w-full max-w-sm rounded-xl object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
            <Film className="size-6" strokeWidth={1.7} />
          </span>
        )}
        <span className="text-sm font-semibold">{file ? file.name : 'Choose a video'}</span>
        <span className="text-xs text-muted-foreground">MP4, WebM or MOV · up to 60 MB</span>
        <input type="file" accept={TYPES.join(',')} className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-title">Title *</Label>
        <Input id="v-title" name="title" required minLength={3} maxLength={120} placeholder="e.g. How to take a good leaf photo" className="h-11 rounded-2xl bg-[var(--crop-cream)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-lang">Language</Label>
          <select id="v-lang" name="language" defaultValue="hi" className="h-11 rounded-2xl border border-input bg-[var(--crop-cream)] px-3">
            <option value="hi">Hindi</option>
            <option value="en">English</option>
            <option value="mr">Marathi</option>
            <option value="pa">Punjabi</option>
            <option value="bn">Bengali</option>
            <option value="te">Telugu</option>
            <option value="ta">Tamil</option>
            <option value="gu">Gujarati</option>
            <option value="kn">Kannada</option>
            <option value="ml">Malayalam</option>
            <option value="or">Odia</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-desc">What farmers will learn</Label>
          <Textarea id="v-desc" name="description" maxLength={1000} rows={2} className="rounded-2xl bg-[var(--crop-cream)]" />
        </div>
      </div>
      {progress !== null && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <span className="text-sm">Uploading… {progress}%</span>
          <Progress value={progress} />
        </div>
      )}
      {message && (
        <Alert variant={message.ok ? 'default' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={progress !== null || !file} className="h-12 w-full rounded-2xl text-base sm:w-fit sm:px-6">
        {progress !== null ? <Loader2 className="animate-spin" /> : <Upload />} Submit for review
      </Button>
    </form>
  );
}
