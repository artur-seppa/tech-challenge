export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function toPaginatedResult<T>(
  data: T[],
  params: { page: number; pageSize: number; total: number },
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total: params.total,
      totalPages: Math.ceil(params.total / params.pageSize),
    },
  };
}
