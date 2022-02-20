import { AnySchema } from 'yup';
import ApiAdapterError from './ApiAdapterError';
import getStatusCodeErrorMessage from './getStatusCodeErrorMessage';

interface FetchOptions<T> {
  requestOptions?: RequestInit
  validateSchema: AnySchema<T>
}

const fetchRest = async<T> (url: string, fetchOptions: FetchOptions<T>): Promise<T> => {
  const res = await fetch(url, fetchOptions?.requestOptions);

  await handleStatusCode(res);

  const json = await res.json();

  if (fetchOptions?.validateSchema) {
    try {
      const validationResult = await fetchOptions.validateSchema.validate(json, {
        strict: true,
        abortEarly: false,
      });

      return validationResult;
    } catch (err) {
      console.error(err);
      throw new ApiAdapterError('API contract violation. Try again later.');
    }
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
