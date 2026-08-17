'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useCreateTransaction } from '../../hooks/use-create-transaction';
import { useTransferTypes } from '../../hooks/use-transfer-types';
import { createTransactionFormSchema } from '../../lib/transactions/create-transaction.schema';

const initialValues = {
  accountExternalIdDebit: '',
  accountExternalIdCredit: '',
  transferTypeId: '',
  value: '',
};

type FieldName = keyof typeof initialValues;

const FIELD_ERROR_MESSAGES: Record<FieldName, string> = {
  accountExternalIdDebit: 'Informe um GUID válido (ex.: 3fa85f64-5717-4562-b3fc-2c963f66afa7).',
  accountExternalIdCredit: 'Informe um GUID válido (ex.: 3fa85f64-5717-4562-b3fc-2c963f66afa7).',
  transferTypeId: 'Informe um número inteiro maior que zero.',
  value: 'Informe um valor maior que zero, com no máximo 2 casas decimais.',
};

const UUID_PLACEHOLDER = '3fa85f64-5717-4562-b3fc-2c963f66afa7';

const inputClassName =
  'mt-1 rounded border border-ink-muted bg-surface px-2 py-1 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent';
const labelClassName = 'flex flex-col text-sm text-ink';

interface FormFieldProps {
  label: string;
  error?: string | undefined;
  errorId?: string;
  children: ReactNode;
}

function FormField({ label, error, errorId, children }: FormFieldProps) {
  return (
    <label className={labelClassName}>
      {label}
      {children}
      {error && (
        <span id={errorId} className="mt-1 text-xs text-stamp-rejected">
          {error}
        </span>
      )}
    </label>
  );
}

export function CreateTransactionForm() {
  const [values, setValues] = useState(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  // One key per submission attempt, reused across retries so the backend recognizes them as one
  // request, rotated only after a real success. See DECISIONS.md "Idempotência...".
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const { mutate, isPending, isError, isSuccess, data } = useCreateTransaction();
  const transferTypesQuery = useTransferTypes();

  const updateField = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = createTransactionFormSchema.safeParse({
      accountExternalIdDebit: values.accountExternalIdDebit,
      accountExternalIdCredit: values.accountExternalIdCredit,
      transferTypeId: Number(values.transferTypeId),
      value: Number(values.value),
    });

    if (!result.success) {
      const invalidFields = Object.keys(result.error.flatten().fieldErrors) as FieldName[];
      setFieldErrors(
        Object.fromEntries(invalidFields.map((field) => [field, FIELD_ERROR_MESSAGES[field]])),
      );
      setValidationError('Dados inválidos. Confira os campos e tente novamente.');
      return;
    }

    setFieldErrors({});
    setValidationError(null);
    mutate(
      { input: result.data, idempotencyKey },
      {
        onSuccess: () => {
          setValues(initialValues);
          setIdempotencyKey(crypto.randomUUID());
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        label="Conta de débito"
        error={fieldErrors.accountExternalIdDebit}
        errorId="accountExternalIdDebit-error"
      >
        <input
          value={values.accountExternalIdDebit}
          onChange={(event) => updateField('accountExternalIdDebit', event.target.value)}
          placeholder={UUID_PLACEHOLDER}
          aria-invalid={Boolean(fieldErrors.accountExternalIdDebit)}
          aria-describedby={
            fieldErrors.accountExternalIdDebit ? 'accountExternalIdDebit-error' : undefined
          }
          className={`${inputClassName} font-display`}
        />
      </FormField>
      <FormField
        label="Conta de crédito"
        error={fieldErrors.accountExternalIdCredit}
        errorId="accountExternalIdCredit-error"
      >
        <input
          value={values.accountExternalIdCredit}
          onChange={(event) => updateField('accountExternalIdCredit', event.target.value)}
          placeholder={UUID_PLACEHOLDER}
          aria-invalid={Boolean(fieldErrors.accountExternalIdCredit)}
          aria-describedby={
            fieldErrors.accountExternalIdCredit ? 'accountExternalIdCredit-error' : undefined
          }
          className={`${inputClassName} font-display`}
        />
      </FormField>
      <FormField
        label="Tipo de transferência"
        error={fieldErrors.transferTypeId}
        errorId="transferTypeId-error"
      >
        <select
          value={values.transferTypeId}
          onChange={(event) => updateField('transferTypeId', event.target.value)}
          disabled={transferTypesQuery.isLoading}
          aria-invalid={Boolean(fieldErrors.transferTypeId)}
          aria-describedby={fieldErrors.transferTypeId ? 'transferTypeId-error' : undefined}
          className={inputClassName}
        >
          <option value="">
            {transferTypesQuery.isLoading ? 'Carregando tipos…' : 'Selecione um tipo'}
          </option>
          {transferTypesQuery.data?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {transferTypesQuery.isError && (
          <span className="mt-1 text-xs text-stamp-rejected">
            Não foi possível carregar os tipos de transferência.
          </span>
        )}
      </FormField>
      <FormField label="Valor" error={fieldErrors.value} errorId="value-error">
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.value}
          onChange={(event) => updateField('value', event.target.value)}
          aria-invalid={Boolean(fieldErrors.value)}
          aria-describedby={fieldErrors.value ? 'value-error' : undefined}
          className={`${inputClassName} font-display`}
        />
      </FormField>

      {validationError && <p role="alert">{validationError}</p>}
      {isError && <p role="alert">Não foi possível criar a transação. Tente novamente.</p>}
      {isSuccess && data && <p>Transação criada com sucesso.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
      >
        {isPending ? 'Criando…' : 'Criar transação'}
      </button>
    </form>
  );
}
