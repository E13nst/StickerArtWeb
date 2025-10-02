export interface CategoryDto {
  id: number;
  key: string;
  name: string;
  description: string;
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CategoriesResponse {
  content: CategoryDto[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

