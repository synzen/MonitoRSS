import {
  Button, InputGroup, InputRightElement, Textarea,
} from '@chakra-ui/react';
import { Formik } from 'formik';

interface Props {
  text: string
}

interface FormValues {
  text: string
}

export const TextForm: React.FC<Props> = ({ text }) => {
  const initialValues: FormValues = {
    text,
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={(values, { setSubmitting }) => {
        setTimeout(() => {
          setSubmitting(false);
        }, 2000);
      }}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
        <form onSubmit={handleSubmit}>
          <InputGroup>
            <Textarea
              name="text"
              value={values.text}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Message"
              size="lg"
              isInvalid={!!touched.text && !!errors.text}
            />
            <InputRightElement
              type="submit"
              disabled={isSubmitting}
            >
              <Button
                type="submit"
                variantColor="blue"
                isLoading={isSubmitting}
              >
                Submit
              </Button>
            </InputRightElement>
          </InputGroup>
        </form>
      )}
    </Formik>
  );
};
