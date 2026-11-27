export type CourseVideoFile = {
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
};

type VideoDuration = { durationSeconds?: number };
type VideoSize = { sizeBytes?: number };

export function courseDocuments<T extends { storedFileName?: string }>(course: {
  documents?: T[] | null;
}): T[] {
  return Array.isArray(course.documents) ? course.documents : [];
}

export function courseVideos<T extends { storedFileName?: string }>(course: {
  video?: T | null;
  videos?: T[] | null;
}): T[] {
  if (Array.isArray(course.videos) && course.videos.length > 0) return course.videos;
  if (course.video?.storedFileName) return [course.video];
  return [];
}

export function courseDurationSeconds(course: {
  video?: VideoDuration | null;
  videos?: VideoDuration[] | null;
}): number {
  const list =
    Array.isArray(course.videos) && course.videos.length > 0
      ? course.videos
      : course.video
        ? [course.video]
        : [];
  return list.reduce((total, item) => {
    const duration = item.durationSeconds ?? 0;
    return total + (Number.isFinite(duration) ? duration : 0);
  }, 0);
}

export function courseSizeBytes(course: {
  video?: VideoSize | null;
  videos?: VideoSize[] | null;
}): number {
  const list =
    Array.isArray(course.videos) && course.videos.length > 0
      ? course.videos
      : course.video
        ? [course.video]
        : [];
  return list.reduce((total, item) => {
    const size = item.sizeBytes ?? 0;
    return total + (Number.isFinite(size) ? size : 0);
  }, 0);
}
