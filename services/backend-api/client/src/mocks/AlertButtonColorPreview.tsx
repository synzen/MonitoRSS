import { Alert, Button, Heading, Stack, Text } from "@chakra-ui/react";

export const AlertButtonColorPreview = () => (
  <Stack maxW="2xl" mx="auto" p={{ base: 4, md: 8 }} gap={6}>
    <Stack gap={1}>
      <Heading size="lg">Alert action colors</Heading>
      <Text color="fg.muted">
        Preview the outline action treatment within warning and error alerts.
      </Text>
    </Stack>
    <Alert.Root status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Some feeds need your attention</Alert.Title>
        <Alert.Description>
          Delivery may be paused until the affected feed settings are updated.
        </Alert.Description>
        <Button mt={3} alignSelf="flex-start" size="sm" variant="outline">
          Review affected feeds
        </Button>
      </Alert.Content>
    </Alert.Root>
    <Alert.Root status="error">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Unable to save your changes</Alert.Title>
        <Alert.Description>
          Try again after checking your connection and the affected feed settings.
        </Alert.Description>
        <Button mt={3} alignSelf="flex-start" size="sm" variant="outline">
          Try again
        </Button>
      </Alert.Content>
    </Alert.Root>
  </Stack>
);
