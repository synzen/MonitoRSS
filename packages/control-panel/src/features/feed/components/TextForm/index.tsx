import { Form, Formik } from 'formik';
import { InferType, object, string } from 'yup';
import { Button, Stack } from '@chakra-ui/react';
import { FormikTextarea } from '@/components/FormikTextarea';

interface Props {
  text: string
}

const FormSchema = object({
  text: string().required(),
});

type FormValues = InferType<typeof FormSchema>;

export const TextForm: React.FC<Props> = ({ text }) => {
  const initialValues: FormValues = {
    text,
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={FormSchema}
      onSubmit={(values, { setSubmitting }) => {
        console.log(values);
        setTimeout(() => {
          setSubmitting(false);
        }, 2000);
      }}
    >
      {({
        isSubmitting,
        isValid,
      }) => (
        <Form>
          <Stack>
            <FormikTextarea
              name="text"
              textareaProps={{
                'aria-label': 'Feed text',
              }}
            />
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isSubmitting}
              disabled={!isValid || isSubmitting}
            >
              Save
            </Button>
          </Stack>
        </Form>
      )}
    </Formik>
  );
};
