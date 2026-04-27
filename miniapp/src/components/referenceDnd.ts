/** DnD payload: перенос между слотами референса пресета */
export const DND_PRESET_REF_IMAGE_MIME = 'application/x-stixly-ref-image';

export const DND_SOURCE_STRIP_MIME = 'application/x-stixly-source-strip';

export interface PresetReferenceMovePayload {
  imageId: string;
  fromKey: string;
  fromIndex: number;
}

export interface SourceStripDragPayload {
  sourceIndex: number;
}

const getDragTypes = (dataTransfer: DataTransfer | null | undefined): string[] => {
  return Array.from(dataTransfer?.types ?? []);
};

export const hasExternalFilesDrag = (dataTransfer: DataTransfer | null | undefined): boolean => {
  return getDragTypes(dataTransfer).includes('Files');
};

export const hasPresetReferenceDrag = (dataTransfer: DataTransfer | null | undefined): boolean => {
  return getDragTypes(dataTransfer).includes(DND_PRESET_REF_IMAGE_MIME);
};

export const hasSourceStripDrag = (dataTransfer: DataTransfer | null | undefined): boolean => {
  return getDragTypes(dataTransfer).includes(DND_SOURCE_STRIP_MIME);
};

export const parsePresetReferenceDrag = (
  dataTransfer: DataTransfer | null | undefined,
): PresetReferenceMovePayload | null => {
  const raw = dataTransfer?.getData(DND_PRESET_REF_IMAGE_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PresetReferenceMovePayload;
    if (!parsed?.imageId || typeof parsed.fromKey !== 'string' || typeof parsed.fromIndex !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const parseSourceStripDrag = (
  dataTransfer: DataTransfer | null | undefined,
): SourceStripDragPayload | null => {
  const raw = dataTransfer?.getData(DND_SOURCE_STRIP_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SourceStripDragPayload;
    if (typeof parsed?.sourceIndex !== 'number' || parsed.sourceIndex < 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};
