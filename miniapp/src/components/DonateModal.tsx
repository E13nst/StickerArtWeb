import React, { useState, useCallback } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { CloseIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { apiClient } from '@/api/client';
import { DonationPrepareResponse } from '@/types/sticker';
import './DonateModal.css';

interface DonateModalProps {
  open: boolean;
  onClose: () => void;
  stickerSetId: number;
  authorName?: string;
}

const TON_TO_NANO = 1_000_000_000n;
const MIN_AMOUNT_NANO = 1_000_000n;
const MAX_AMOUNT_NANO = 1_000_000_000_000n;
const PRESET_AMOUNTS = [1, 5, 10];
const DONATE_ACCENT_COLOR = '#FFD700';
const DONATE_ACCENT_COLOR_DARK = '#FFC107';

export const DonateModal: React.FC<DonateModalProps> = ({
  open,
  onClose,
  stickerSetId,
  authorName
}) => {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const [amount, setAmount] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [prepareData, setPrepareData] = useState<DonationPrepareResponse | null>(null);

  const resetAndClose = useCallback(() => {
    setAmount('');
    setSelectedPreset(null);
    setError(null);
    setSuccess(false);
    setPrepareData(null);
    onClose();
  }, [onClose]);

  const handleClose = useCallback((_event?: unknown, reason?: string) => {
    if (isLoading) return;
    if (reason === 'backdropClick' && !success) return;
    if (reason === 'escapeKeyDown' && !success) return;
    resetAndClose();
  }, [isLoading, success, resetAndClose]);

  const handleOverlayOrEscapeClose = useCallback(() => {
    if (isLoading) return;
    if (!success) return;
    resetAndClose();
  }, [isLoading, success, resetAndClose]);

  const handlePresetClick = useCallback((presetAmount: number) => {
    setSelectedPreset(presetAmount);
    setAmount(presetAmount.toString());
    setError(null);
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setSelectedPreset(null);
      setError(null);
    }
  }, []);

  const validateAmount = useCallback((tonAmount: string): { valid: boolean; amountNano: bigint | null; error: string | null } => {
    if (!tonAmount || tonAmount.trim() === '') {
      return { valid: false, amountNano: null, error: 'Введите сумму доната' };
    }
    const numValue = parseFloat(tonAmount);
    if (isNaN(numValue) || numValue <= 0) {
      return { valid: false, amountNano: null, error: 'Сумма должна быть больше нуля' };
    }
    const amountNano = BigInt(Math.floor(numValue * 1_000_000_000));
    if (amountNano < MIN_AMOUNT_NANO) {
      return { valid: false, amountNano: null, error: `Минимальная сумма: ${Number(MIN_AMOUNT_NANO) / Number(TON_TO_NANO)} TON` };
    }
    if (amountNano > MAX_AMOUNT_NANO) {
      return { valid: false, amountNano: null, error: `Максимальная сумма: ${Number(MAX_AMOUNT_NANO) / Number(TON_TO_NANO)} TON` };
    }
    return { valid: true, amountNano, error: null };
  }, []);

  const handlePrepareDonation = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const validation = validateAmount(amount);
      if (!validation.valid || !validation.amountNano) {
        setError(validation.error || 'Неверная сумма');
        setIsLoading(false);
        return;
      }
      const prepareResponse = await apiClient.prepareDonation(stickerSetId, Number(validation.amountNano));
      setPrepareData(prepareResponse);
      if (!tonAddress) {
        setError('Пожалуйста, подключите кошелёк для отправки доната');
        setIsLoading(false);
        return;
      }
      if (!prepareResponse.legs || prepareResponse.legs.length === 0) {
        setError('Не удалось получить данные для транзакции');
        setIsLoading(false);
        return;
      }
      const leg = prepareResponse.legs[0];
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: leg.toWalletAddress, amount: leg.amountNano.toString() }]
      };
      const result = await tonConnectUI.sendTransaction(transaction);
      if (result.boc) {
        const txHash = result.boc;
        const confirmResponse = await apiClient.confirmDonation(prepareResponse.intentId, txHash, tonAddress);
        if (confirmResponse.success) {
          setSuccess(true);
        } else {
          setError(confirmResponse.message || 'Не удалось подтвердить транзакцию');
        }
      } else {
        setError('Транзакция не была отправлена');
      }
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { status?: number; data?: { message?: string } } };
      if (e?.message?.includes('User rejected')) {
        setError('Вы отменили транзакцию');
      } else if (e?.response?.status === 400) {
        setError(e?.response?.data?.message || 'Автор не привязал кошелёк для получения донатов');
      } else if (e?.response?.status === 404) {
        setError('Стикерсет не найден');
      } else {
        setError(e?.message || 'Произошла ошибка при отправке доната. Попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [amount, stickerSetId, tonConnectUI, tonAddress, validateAmount]);

  const canSend = amount.trim() !== '' && !isLoading && !success;
  const displayAuthorName = authorName || 'автора';

  if (!open) return null;

  return (
    <BottomSheet
      isOpen={open}
      onClose={handleOverlayOrEscapeClose}
      title=""
      showCloseButton={false}
      className="donate-modal"
    >
      <div className="donate-modal__inner" onClick={e => e.stopPropagation()}>
        <div className="donate-modal__header">
          <Text variant="h3" weight="bold" className="donate-modal__title">Поддержать автора</Text>
          <button
            type="button"
            className="donate-modal__close"
            onClick={() => handleClose(undefined, 'buttonClick')}
            disabled={isLoading}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="donate-modal__body">
          {success ? (
            <div className="donate-modal__success">
              <div className="donate-modal__success-icon">
                <CheckCircleIcon />
              </div>
              <Text variant="h3" weight="bold" className="donate-modal__success-title">
                Спасибо за поддержку автора ❤️
              </Text>
              <Text variant="bodySmall" color="hint">
                Ваш донат успешно отправлен!
              </Text>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="donate-modal__alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} aria-label="Закрыть">×</button>
                </div>
              )}
              <Text variant="bodySmall" color="hint" className="donate-modal__hint">
                Выберите сумму доната для <strong>{displayAuthorName}</strong>
              </Text>
              <div className="donate-modal__presets">
                {PRESET_AMOUNTS.map((preset) => (
                  <Button
                    key={preset}
                    variant={selectedPreset === preset ? 'primary' : 'outline'}
                    size="medium"
                    onClick={() => handlePresetClick(preset)}
                    disabled={isLoading}
                    className={`donate-modal__preset ${selectedPreset === preset ? 'donate-modal__preset--selected' : ''}`}
                  >
                    {preset} TON
                  </Button>
                ))}
              </div>
              <div className="donate-modal__field">
                <label className="donate-modal__label">Сумма (TON)</label>
                <div className="donate-modal__input-wrap">
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={isLoading}
                    placeholder="0.0"
                    className="donate-modal__input"
                  />
                  <span className="donate-modal__suffix">TON</span>
                </div>
              </div>
              {amount && !error && validateAmount(amount).valid && (
                <div className="donate-modal__summary">
                  <Text variant="caption" color="hint">Будет отправлено</Text>
                  <Text variant="h3" weight="bold" style={{ color: DONATE_ACCENT_COLOR }}>{amount} TON</Text>
                </div>
              )}
            </>
          )}
        </div>

        <div className="donate-modal__actions">
          {success ? (
            <Button variant="primary" size="large" onClick={() => handleClose(undefined, 'buttonClick')} className="donate-modal__btn">
              Закрыть
            </Button>
          ) : (
            <Button
              variant="primary"
              size="large"
              onClick={handlePrepareDonation}
              disabled={!canSend}
              loading={isLoading}
              className="donate-modal__btn donate-modal__btn--submit"
              style={canSend ? { backgroundColor: DONATE_ACCENT_COLOR, color: '#000' } : undefined}
            >
              {isLoading ? 'Отправка...' : `Отправить ${displayAuthorName}`}
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
