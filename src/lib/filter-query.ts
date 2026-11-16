/**
 * Monta a query string dos filtros a partir dos campos do formulário.
 * @param entries Pares nome/valor do formulário (por exemplo, `new FormData(form)`).
 * @returns Query string sem o "?", só com os campos preenchidos; vazia quando não há filtro.
 */
export function filtersToQuery(entries: Iterable<[string, FormDataEntryValue]>): string {
  const params = new URLSearchParams()
  for (const [key, value] of entries) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) params.set(key, trimmed)
  }
  return params.toString()
}
