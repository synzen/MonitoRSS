import { z } from 'zod';
import ApiAdapterError from './ApiAdapterError';
import getStatusCodeErrorMessage from './getStatusCodeErrorMessage';

interface FetchOptions<T> {
  requestOptions?: RequestInit
  validateSchema: z.Schema<T>
}

const fetchRest = async<T> (url: string, fetchOptions: FetchOptions<T>): Promise<T> => {
  const res = await fetch(url, fetchOptions?.requestOptions);

  await handleStatusCode(res);

  const json = await res.json();

  if (fetchOptions?.validateSchema) {
    const validationResult = await fetchOptions.validateSchema.safeParseAsync(json);

    if (validationResult.success) {
      return validationResult.data;
    }

    console.error(validationResult.error);

    throw new ApiAdapterError('API contract violation. Try again later.');
  }

  return json;
};

const handleStatusCode = async (res: Response) => {
  if (res.ok) {
    return res;
  }

  if (res.status === 400) {
    const json = await res.json();

    throw new ApiAdapterError(json.message || 'Unknown error');
  }

  const errorMessage = getStatusCodeErrorMessage(res.status);

  throw new ApiAdapterError(errorMessage);
};

export default fetchRest;
