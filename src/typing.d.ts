type BaseResponseModel<T = never> = {
  code: number;
  message?: string;
} & ([T] extends [never] ? Record<string, never> : { data: T });

declare interface ResponseModel<T> {
  total: number;
  list: T[];
  code: number;
  message?: string;
}

declare interface ResponseModelDate<T> {
  total: number;
  data: T[];
  code: number;
  message?: string;
}
