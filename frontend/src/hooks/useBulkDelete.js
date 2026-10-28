import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../context/ConfirmContext';
import { toast, parseErrorResponse } from '../utils/toast';
import { getApiUrl } from '../config/api';

/**
 * Hook factory para handler de borrado masivo desde DataTable.
 *
 * Uso típico desde una página CRUD:
 *
 *   const handleBulkDelete = useBulkDelete({
 *     endpointBase: '/api/matriculas',
 *     onSuccess: () => fetchMatriculasData({ ... }),
 *   });
 *   ...
 *   <DataTable selectable onBulkDelete={handleBulkDelete} ... />
 *
 * Estrategia: confirm modal con count + `Promise.allSettled` de DELETEs
 * individuales en paralelo. Si falla cualquiera, muestra toast de error con
 * el número de fallos pero refresca igualmente para reflejar los que sí
 * pasaron.
 *
 * @param {object} options
 * @param {string} options.endpointBase - Path base del recurso (sin id), p.ej. `/api/matriculas`. El handler hace `DELETE {base}/{id}` por cada id.
 * @param {function} options.onSuccess - Callback tras el batch (aunque haya errores parciales). Debe refrescar la lista.
 * @param {string} [options.confirmTitleKey='dataTable.bulkDeleteConfirmTitle'] - Clave i18n para el título del confirm modal.
 * @param {string} [options.confirmBodyKey='dataTable.bulkDeleteConfirmBody'] - Clave i18n para el body del confirm modal.
 * @returns {function(ids: Array): Promise<void>}
 */
export function useBulkDelete({
    endpointBase,
    onSuccess,
    confirmTitleKey = 'dataTable.bulkDeleteConfirmTitle',
    confirmBodyKey = 'dataTable.bulkDeleteConfirmBody',
}) {
    const { t } = useTranslation();
    const confirm = useConfirm();

    return useCallback(async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return;
        const ok = await confirm({
            title: t(confirmTitleKey, { count: ids.length }),
            body: t(confirmBodyKey, { count: ids.length }),
        });
        if (!ok) return;

        const results = await Promise.allSettled(
            ids.map(id =>
                fetch(getApiUrl(`${endpointBase}/${id}`), {
                    method: 'DELETE',
                    credentials: 'include',
                })
            )
        );

        let failed = 0;
        let firstError = null;
        for (const r of results) {
            if (r.status === 'rejected') {
                failed++;
                if (!firstError) firstError = r.reason?.message || String(r.reason);
            } else if (!r.value.ok) {
                failed++;
                if (!firstError) {
                    try {
                        firstError = await parseErrorResponse(r.value, `HTTP ${r.value.status}`);
                    } catch (_) {
                        firstError = `HTTP ${r.value.status}`;
                    }
                }
            }
        }

        if (typeof onSuccess === 'function') {
            try { await onSuccess(); } catch (_) { /* ignorar — solo es refresh */ }
        }

        const ok_count = ids.length - failed;
        if (failed === 0) {
            toast.success(t('dataTable.bulkDeleteSuccess', { count: ok_count }));
        } else if (ok_count === 0) {
            toast.error(t('dataTable.bulkDeleteError', { count: ids.length, err: firstError || '?' }));
        } else {
            toast.warning(
                t('dataTable.bulkDeleteSuccess', { count: ok_count }),
                { description: t('dataTable.bulkDeleteError', { count: failed, err: firstError || '?' }) }
            );
        }
    }, [endpointBase, onSuccess, confirmTitleKey, confirmBodyKey, t, confirm]);
}
