export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        totalItems: number;
        totalPages: number;
        currentPage: number;
        itemsPerPage: number;
    };
}