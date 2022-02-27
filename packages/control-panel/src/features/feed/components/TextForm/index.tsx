import { Form, Formik } from 'formik';
import { InferType, object, string } from 'yup';
import { Button, Stack } from '@chakra-ui/react';
import { FormikTextarea } from '@/components/FormikTextarea';
import { updateFeed } from '@/features/feed';
import { notifyError } from '@/utils/notifyError';

interface Props {
  feedId: string
  text: string
  onUpdated: () => Promise<any>
}

const FormSchema = object({
  text: string().required(),
});

type FormValues = InferType<typeof FormSchema>;

export const TextForm: React.FC<Props> = ({ feedId, text, onUpdated }) => {
  const initialValues: FormValues = {
    text,
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={FormSchema}
      onSubmit={async (values) => {
        try {
          await updateFeed({
            feedId,
            details: {
              text: values.text,
            },
          });
          await onUpdated();
        } catch (err) {
          notifyError('Failed to update text', err as Error);
        }
      }}
    >
      {({
        isSubmitting,
        isValid,
        values,
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
              disabled={!isValid || isSubmitting || text === values.text}
            >
              Save
            </Button>
          </Stack>
        </Form>
      )}
    </Formik>
  );
};
