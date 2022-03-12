import { AnySchema, ValidationError } from 'yup';
import ApiAdapterError from './ApiAdapterError';
import getStatusCodeErrorMessage from './getStatusCodeErrorMessage';

interface FetchOptions<T> {
  requestOptions?: RequestInit
  validateSchema?: AnySchema<T>
  skipJsonParse?: boolean
}

const fetchRest = async<T> (url: string, fetchOptions?: FetchOptions<T>): Promise<T> => {
  const headers = determineHeaders(fetchOptions?.requestOptions);
  const res = await fetch(url, {
    ...fetchOptions?.requestOptions,
    headers,
  });

  await handleStatusCode(res);
  let json: any;

  if (!fetchOptions?.skipJsonParse && res.status !== 204) {
    json = await res.json();
  }

  if (json && fetchOptions?.validateSchema) {
    try {
      const validationResult = await fetchOptions.validateSchema.validate(json, {
        strict: true,
        abortEarly: false,
      });

      return validationResult;
    } catch (err) {
      const yupErr = err as ValidationError;
      console.error(url, yupErr.errors);
      throw new ApiAdapterError('API contract violation detected. Try again later.');
    }
  }

  return json;
};

const determineHeaders = (requestOptions?: RequestInit) => {
  const headers: RequestInit['headers'] = {};

  if (['POST', 'PUT', 'PATCH', 'GET'].includes(requestOptions?.method?.toUpperCase() || '')) {
    headers['Content-Type'] = 'application/json';
  }

  return {
    ...headers,
    ...requestOptions?.headers,
  };
};

const handleStatusCode = async (res: Response) => {
  if (res.ok) {
    return res;
  }

  if (res.status === 400) {
    const json = await res.json();

    throw new ApiAdapterError(json.message || 'Unknown error', {
      statusCode: res.status,
    });
  }

  const errorMessage = getStatusCodeErrorMessage(res.status);

  throw new ApiAdapterError(errorMessage, {
    statusCode: res.status,
  });
};

export default fetchRest;
