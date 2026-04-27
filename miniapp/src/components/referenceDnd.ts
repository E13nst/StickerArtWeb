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
