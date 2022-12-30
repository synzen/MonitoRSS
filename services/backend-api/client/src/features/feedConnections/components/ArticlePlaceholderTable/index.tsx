import {
  Box,
  Code,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface Props {
  article: Record<string, string>
  asPlaceholders?: boolean
}

export const ArticlePlaceholderTable = ({ article, asPlaceholders }: Props) => {
  const { t } = useTranslation();

  return (
    <Box>

      <Box
        position="relative"
        border="solid 1px"
        borderColor="gray.600"
        borderRadius="md"
      >
        <Box
          maxHeight="sm"
          overflow="auto"
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>
                    {asPlaceholders ? t('features.feedConnections.components'
                    + '.articlePlaceholderTable.columnHeaderPlaceholder')
                      : t('features.feedConnections.components'
                    + '.articlePlaceholderTable.columnHeaderProperty')}
                  </Th>
                  <Th>
                    {t('features.feedConnections.components'
                    + '.articlePlaceholderTable.columnHeaderValue')}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(article).map(([key, value]) => (
                  <Tr key={key}>
                    <Td>{asPlaceholders ? <Code>{`{{${key}}}`}</Code> : key}</Td>
                    <Td>{value}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
};
