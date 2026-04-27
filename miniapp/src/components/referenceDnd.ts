/** DnD payload: перенос между слотами референса пресета */
export const DND_PRESET_REF_IMAGE_MIME = 'application/x-stixly-ref-image';

export const DND_SOURCE_STRIP_MIME = 'application/x-stixly-source-strip';

const DND_TEXT_PREFIX = 'stixly-dnd:';

export interface PresetReferenceMovePayload {
  imageId: string;
  fromKey: string;
  fromIndex: number;
}

export interface SourceStripDragPayload {
  sourceIndex: number;
}

const encodeTextPayload = (type: string, payload: unknown): string => {
  return `${DND_TEXT_PREFIX}${type}:${JSON.stringify(payload)}`;
};

const parseTextPayload = <T>(raw: string | undefined, type: string): T | null => {
  const prefix = `${DND_TEXT_PREFIX}${type}:`;
  if (!raw?.startsWith(prefix)) return null;
  try {
    return JSON.parse(raw.slice(prefix.length)) as T;
  } catch {
    return null;
  }
};

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

export const setPresetReferenceDragData = (
  dataTransfer: DataTransfer,
  payload: PresetReferenceMovePayload,
): void => {
  try {
    dataTransfer.clearData();
  } catch {
    /* ignore if not allowed in this phase */
  }
  const body = JSON.stringify(payload);
  // «Сначала text/plain» — кастомный тип иногда пустеет в drop, префикс — запасной путь
  dataTransfer.setData('text/plain', encodeTextPayload(DND_PRESET_REF_IMAGE_MIME, payload));
  dataTransfer.setData(DND_PRESET_REF_IMAGE_MIME, body);
};

export const setSourceStripDragData = (
  dataTransfer: DataTransfer,
  payload: SourceStripDragPayload,
): void => {
  try {
    dataTransfer.clearData();
  } catch {
    /* ignore if not allowed in this phase */
  }
  const body = JSON.stringify(payload);
  dataTransfer.setData('text/plain', encodeTextPayload(DND_SOURCE_STRIP_MIME, payload));
  dataTransfer.setData(DND_SOURCE_STRIP_MIME, body);
};

const getPlainTextForDrag = (dataTransfer: DataTransfer | null | undefined): string | undefined => {
  if (!dataTransfer) return undefined;
  const t =
    dataTransfer.getData('text/plain') ||
    // legacy: иногда data доступен под типом "Text"
    (typeof (dataTransfer as { getData?: (f: string) => string }).getData === 'function'
      ? (dataTransfer as { getData: (f: string) => string }).getData('Text')
      : '') ||
    '';
  return t || undefined;
};

export const parsePresetReferenceDrag = (
  dataTransfer: DataTransfer | null | undefined,
): PresetReferenceMovePayload | null => {
  const fromMime = dataTransfer?.getData(DND_PRESET_REF_IMAGE_MIME) || '';
  const fromPlain = parseTextPayload<PresetReferenceMovePayload>(getPlainTextForDrag(dataTransfer), DND_PRESET_REF_IMAGE_MIME);
  const raw = fromMime || fromPlain;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) as PresetReferenceMovePayload : raw;
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
  const fromMime = dataTransfer?.getData(DND_SOURCE_STRIP_MIME) || '';
  const fromPlain = parseTextPayload<SourceStripDragPayload>(getPlainTextForDrag(dataTransfer), DND_SOURCE_STRIP_MIME);
  const raw = fromMime || fromPlain;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) as SourceStripDragPayload : raw;
    if (typeof parsed?.sourceIndex !== 'number' || parsed.sourceIndex < 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};
