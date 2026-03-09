import { useCallback } from 'react';
import type { DiagnosticsResult } from '../hooks/useMediaDiagnostics';
import './PackCardDebugOverlay.css';

interface PackCardDebugOverlayProps {
  result: DiagnosticsResult;
  fileId: string;
}

function codecLabel(value: string): string {
  if (value === 'probably') return '✓';
  if (value === 'maybe') return '?';
  return '✗';
}

export function PackCardDebugOverlay({ result, fileId }: PackCardDebugOverlayProps) {
  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      // fallback ignored for overlay
    }
  }, [result]);

  const { codecSupport, network, dom, playback, meta, hasFailed, failureReasons } = result;

  return (
    <div className="pack-card-debug-overlay" role="status" aria-live="polite">
      <div
        className={`pack-card-debug-overlay__header ${hasFailed ? 'pack-card-debug-overlay__header--fail' : 'pack-card-debug-overlay__header--ok'}`}
      >
        {hasFailed ? 'DIAG FAIL' : 'DIAG OK'}
      </div>
      <div className="pack-card-debug-overlay__body">
        {failureReasons.length > 0 && (
          <div className="pack-card-debug-overlay__section">
            <div className="pack-card-debug-overlay__label">Reasons</div>
            <ul className="pack-card-debug-overlay__list">
              {failureReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="pack-card-debug-overlay__section">
          <div className="pack-card-debug-overlay__label">Codecs</div>
          <div className="pack-card-debug-overlay__row">
            <span
              className={
                codecSupport.vp8 ? 'pack-card-debug-overlay__codec-ok' : 'pack-card-debug-overlay__codec-fail'
              }
            >
              vp8:{codecLabel(codecSupport.vp8)}
            </span>
            <span
              className={
                codecSupport.vp9 ? 'pack-card-debug-overlay__codec-ok' : 'pack-card-debug-overlay__codec-fail'
              }
            >
              vp9:{codecLabel(codecSupport.vp9)}
            </span>
            <span
              className={
                codecSupport.h264 ? 'pack-card-debug-overlay__codec-ok' : 'pack-card-debug-overlay__codec-fail'
              }
            >
              h264:{codecLabel(codecSupport.h264)}
            </span>
          </div>
        </div>
        <div className="pack-card-debug-overlay__section">
          <div className="pack-card-debug-overlay__label">Network</div>
          <div className="pack-card-debug-overlay__row">
            {network.isBlobUrl ? (
              <span>blob URL</span>
            ) : (
              <>
                {network.httpStatus != null && <span>HTTP {network.httpStatus}</span>}
                {network.fetchMs != null && <span> {network.fetchMs}ms</span>}
                {network.error && <span className="pack-card-debug-overlay__err"> {network.error}</span>}
              </>
            )}
          </div>
          {(network.contentType || network.acceptRanges != null || network.contentLength) && (
            <div className="pack-card-debug-overlay__row">
              {network.contentType && (
                <span
                  className={
                    network.contentType.includes('video')
                      ? 'pack-card-debug-overlay__codec-ok'
                      : 'pack-card-debug-overlay__err'
                  }
                >
                  {network.contentType}
                </span>
              )}
              {network.acceptRanges != null && (
                <span
                  className={
                    network.acceptRanges === 'bytes'
                      ? 'pack-card-debug-overlay__codec-ok'
                      : 'pack-card-debug-overlay__err'
                  }
                >
                  {' '}ranges:{network.acceptRanges || 'none'}
                </span>
              )}
              {network.contentLength && <span> {Math.round(Number(network.contentLength) / 1024)}KB</span>}
            </div>
          )}
        </div>
        <div className="pack-card-debug-overlay__section">
          <div className="pack-card-debug-overlay__label">DOM</div>
          <div className="pack-card-debug-overlay__row">
            {dom.width}×{dom.height} {dom.isVisible ? 'visible' : 'hidden'}
          </div>
        </div>
        <div className="pack-card-debug-overlay__section">
          <div className="pack-card-debug-overlay__label">Playback</div>
          <div className="pack-card-debug-overlay__row">
            readyState={playback.readyState} netState={playback.networkState}
            {playback.duration != null && (
              <span
                className={
                  isNaN(playback.duration)
                    ? 'pack-card-debug-overlay__err'
                    : 'pack-card-debug-overlay__codec-ok'
                }
              >
                {' '}dur={isNaN(playback.duration) ? 'NaN' : `${playback.duration.toFixed(1)}s`}
              </span>
            )}
            {' '}blob:{playback.blobCacheHit ? (
              <span className="pack-card-debug-overlay__codec-ok">Y</span>
            ) : (
              <span className="pack-card-debug-overlay__err">N</span>
            )}
            {playback.errorCode != null && playback.errorCode !== 0 && (
              <span className="pack-card-debug-overlay__err">
                {' '}err={playback.errorCode} {playback.errorMessage ?? ''}
              </span>
            )}
          </div>
        </div>
        <div className="pack-card-debug-overlay__section">
          <div className="pack-card-debug-overlay__label">Meta</div>
          <div className="pack-card-debug-overlay__row pack-card-debug-overlay__meta">
            {meta.ua}
          </div>
          <div className="pack-card-debug-overlay__row">
            TG:{meta.isTelegramWebView ? 'Y' : 'N'} fileId={fileId || meta.fileId} diag={meta.diagMs}ms
          </div>
        </div>
      </div>
      <button
        type="button"
        className="pack-card-debug-overlay__copy"
        onClick={handleCopy}
        aria-label="Copy diagnostics JSON"
      >
        Copy
      </button>
    </div>
  );
}
