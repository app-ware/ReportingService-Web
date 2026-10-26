export class Meta {
    apiVersion: string;
    requestId: string;
    timestamp: string;
}

export interface PaginatedServiceResponse<T> {
    data: T[];
    pagination: Pagination;
}

export class Pagination {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
    links?: {
        self?: string;
        first?: string;
        next?: string|null;
        last?: string;
    };
}

export class ApiError {
    status: string;
    code: string;
    title: string;
    detail: { field: string; message: string } | string;
    source?: { pointer: string };
}

export class ApiResponse<T> {
    jsonapi: { version: string };
    meta: Meta;
    message?: string;
    data: T | null;
    pagination?: Pagination;
    errors: ApiError[] | null;
}